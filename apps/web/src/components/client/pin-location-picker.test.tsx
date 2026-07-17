import { clientApi } from '@barber-saas/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PinLocationPicker } from './pin-location-picker';

vi.mock('@/components/client/client-map', () => ({
  ClientMap: ({
    onDestinationChange,
  }: {
    onDestinationChange: (point: unknown) => void;
  }): React.ReactElement => (
    <button
      onClick={() => onDestinationChange({ latitude: 37.6454, longitude: -84.7739 })}
      type="button"
    >
      Move pin
    </button>
  ),
}));

describe('PinLocationPicker', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((_success: PositionCallback, error: PositionErrorCallback) =>
          error({ code: 1 } as GeolocationPositionError),
        ),
      },
    });
  });

  it('allows manual pin placement when geolocation is denied', async () => {
    vi.spyOn(clientApi, 'reverseGeocode').mockResolvedValue({
      addressLine1: '307 W Broadway St',
      city: 'Danville',
      state: 'KY',
      zipCode: '40422',
      country: 'US',
      latitude: 37.6454,
      longitude: -84.7739,
      formattedAddress: '307 W Broadway St, Danville, KY 40422',
    });
    const onLocationChange = vi.fn();

    render(
      <QueryClientProvider client={new QueryClient()}>
        <PinLocationPicker
          fallbackCenter={{ latitude: 37.64, longitude: -84.77 }}
          onLocationChange={onLocationChange}
        />
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/map is centered near the barber/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Move pin' }));

    await waitFor(() => expect(onLocationChange).toHaveBeenCalled());
    expect(onLocationChange).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 37.6454,
        longitude: -84.7739,
      }),
    );
    expect(screen.getByText(/307 W Broadway St/i)).toBeTruthy();
  });

  it('keeps the selected pin when reverse geocoding fails', async () => {
    vi.spyOn(clientApi, 'reverseGeocode').mockRejectedValue(new Error('maps unavailable'));
    const onLocationChange = vi.fn();

    render(
      <QueryClientProvider client={new QueryClient()}>
        <PinLocationPicker
          barberId="11111111-1111-4111-8111-111111111111"
          fallbackAddressContext={{ city: 'Danville', state: 'KY' }}
          fallbackCenter={{ latitude: 37.64, longitude: -84.77 }}
          onLocationChange={onLocationChange}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Move pin' }));

    await waitFor(() =>
      expect(onLocationChange).toHaveBeenCalledWith(
        expect.objectContaining({
          addressLine1: 'Pinned service location',
          isApproximateAddress: true,
          latitude: 37.6454,
          longitude: -84.7739,
          source: 'coordinate_fallback',
        }),
      ),
    );
    expect(await screen.findByText(/Exact pin saved/i)).toBeTruthy();
  });
});
