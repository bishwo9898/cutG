import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BarberLocationAccess } from './barber-location-access';

const installMobileBrowser = (permission: PermissionState = 'prompt'): ReturnType<typeof vi.fn> => {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: true }),
  });
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: vi.fn().mockResolvedValue({ state: permission }) },
  });
  const getCurrentPosition = vi.fn(
    (success: PositionCallback, error: PositionErrorCallback | null | undefined) => {
      if (permission === 'denied') {
        error?.({ code: 1, message: 'Denied', PERMISSION_DENIED: 1 } as GeolocationPositionError);
        return;
      }
      success({
        coords: {
          accuracy: 9,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          latitude: 42.361,
          longitude: -71.057,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      });
    },
  );
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  });
  return getCurrentPosition;
};

describe('BarberLocationAccess', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('requests a fresh high-accuracy position when mobile permission has not been decided', async () => {
    const getCurrentPosition = installMobileBrowser('prompt');

    render(<BarberLocationAccess />);

    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(1));
    expect(getCurrentPosition.mock.calls[0]?.[2]).toEqual({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15_000,
    });
    expect(await screen.findByText(/precise location ready/i)).toBeTruthy();
    expect(screen.getByText(/about 9 metres/i)).toBeTruthy();
  });

  it('shows a recovery action when browser location is denied', async () => {
    const getCurrentPosition = installMobileBrowser('denied');

    render(<BarberLocationAccess />);

    expect(await screen.findByText(/precise location is turned off/i)).toBeTruthy();
    expect(getCurrentPosition).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /enable location/i }));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });
});
