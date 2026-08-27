/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/require-await */
import { ApiError } from '@barber-saas/api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  executor: null as
    null | ((body: { data: { locations: unknown[] }; error: null }) => Promise<void>),
  hasStarted: vi.fn(async () => false),
  startUpdates: vi.fn(async () => undefined),
  stopUpdates: vi.fn(async () => undefined),
  startJourney: vi.fn(),
  sendPing: vi.fn(),
  secure: new Map<string, string>(),
}));

vi.mock('expo-task-manager', () => ({
  isTaskDefined: () => false,
  defineTask: (_name: string, executor: typeof mocks.executor) => {
    mocks.executor = executor;
  },
}));

vi.mock('expo-location', () => ({
  Accuracy: { High: 6 },
  ActivityType: { AutomotiveNavigation: 1 },
  hasStartedLocationUpdatesAsync: mocks.hasStarted,
  startLocationUpdatesAsync: mocks.startUpdates,
  stopLocationUpdatesAsync: mocks.stopUpdates,
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mocks.secure.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mocks.secure.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mocks.secure.delete(key);
  },
}));

vi.mock('@/lib/apiClient', () => ({
  mobileApi: {
    barber: {
      appointment: vi.fn(),
      sendLocationPing: mocks.sendPing,
      startJourney: mocks.startJourney,
    },
  },
}));

import { getBackgroundTrackingSnapshot, startBackgroundJourney } from './backgroundLocation';

const location = (latitude: number, longitude: number) => ({
  coords: {
    accuracy: 4,
    altitude: null,
    altitudeAccuracy: null,
    heading: 180,
    latitude,
    longitude,
    speed: 8,
  },
  mocked: false,
  timestamp: Date.now(),
});

describe('background barber journey tracking', () => {
  beforeEach(() => {
    mocks.secure.clear();
    mocks.hasStarted.mockReset().mockResolvedValue(false);
    mocks.startUpdates.mockReset().mockResolvedValue(undefined);
    mocks.stopUpdates.mockReset().mockResolvedValue(undefined);
    mocks.sendPing.mockReset().mockResolvedValue({ recorded: true });
    mocks.startJourney.mockReset().mockResolvedValue({
      appointment: {
        id: 'appointment-id',
        status: 'ON_THE_WAY',
        departedAt: '2026-08-19T12:00:00.000Z',
      },
      tracking: { active: true, lastPingAt: '2026-08-19T12:00:00.000Z' },
    });
  });

  it('registers the OS task before starting the server journey', async () => {
    await startBackgroundJourney('appointment-id', location(40.7, -73.9));

    expect(mocks.startUpdates).toHaveBeenCalledOnce();
    expect(mocks.startJourney).toHaveBeenCalledWith(
      'appointment-id',
      expect.objectContaining({ latitude: 40.7, longitude: -73.9 }),
    );
    expect(mocks.startUpdates.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.startJourney.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
    await expect(getBackgroundTrackingSnapshot()).resolves.toMatchObject({
      appointmentId: 'appointment-id',
      lastPingAt: '2026-08-19T12:00:00.000Z',
    });
  });

  it('sends only the newest location from a background delivery', async () => {
    await startBackgroundJourney('appointment-id', location(40.7, -73.9));
    mocks.hasStarted.mockResolvedValue(true);
    await mocks.executor?.({
      data: { locations: [location(40.71, -73.91), location(40.72, -73.92)] },
      error: null,
    });

    expect(mocks.sendPing).toHaveBeenCalledWith(
      'appointment-id',
      expect.objectContaining({ latitude: 40.72, longitude: -73.92 }),
    );
  });

  it('stops and clears tracking when the server closes the journey', async () => {
    await startBackgroundJourney('appointment-id', location(40.7, -73.9));
    mocks.hasStarted.mockResolvedValue(true);
    mocks.sendPing.mockRejectedValue(
      new ApiError(400, {
        status: 'error',
        code: 'TRACKING_NOT_ACTIVE',
        message: 'Tracking stopped.',
      }),
    );
    await mocks.executor?.({ data: { locations: [location(40.73, -73.93)] }, error: null });

    expect(mocks.stopUpdates).toHaveBeenCalledOnce();
    await expect(getBackgroundTrackingSnapshot()).resolves.toMatchObject({
      appointmentId: null,
    });
  });
});
