import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ShopLocationEditor } from './shop-location-editor';

import { browserApi } from '@/lib/browser-api';

vi.mock('@/components/client/service-area-map', () => ({
  ServiceAreaMap: ({
    center,
    onDestinationChange,
  }: {
    center: { latitude: number; longitude: number };
    onDestinationChange: (point: { latitude: number; longitude: number }) => void;
  }): React.ReactElement => (
    <div>
      <span>
        Map center {center.latitude}, {center.longitude}
      </span>
      <button
        onClick={() => onDestinationChange({ latitude: 37.646, longitude: -84.773 })}
        type="button"
      >
        Move shop pin
      </button>
    </div>
  ),
}));

const renderEditor = (onChange = vi.fn()): void => {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ShopLocationEditor
        businessName="CutG Studio"
        idPrefix="test-shop"
        onChange={onChange}
        value={null}
      />
    </QueryClientProvider>,
  );
};

describe('ShopLocationEditor', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('searches by business name, previews the closest match, and selects it', async () => {
    const post = vi.spyOn(browserApi, 'post').mockResolvedValue({
      source: 'google_places',
      suggestions: [
        {
          placeId: 'place-1',
          name: 'CutG Studio',
          addressLine1: '120 North 3rd Street',
          city: 'Danville',
          state: 'KY',
          zipCode: '40422',
          country: 'US',
          latitude: 37.6467,
          longitude: -84.7729,
          formattedAddress: '120 N 3rd St, Danville, KY 40422, USA',
          source: 'google_places',
        },
      ],
    });
    const onChange = vi.fn();
    renderEditor(onChange);

    fireEvent.change(screen.getByPlaceholderText(/shop name or full street address/i), {
      target: { value: 'CutG Studio' },
    });

    const [option] = await screen.findAllByRole('option');
    expect(option).toBeDefined();
    expect(screen.getByText(/Map center 37.6467, -84.7729/i)).toBeTruthy();
    fireEvent.click(option as HTMLElement);

    expect(post).toHaveBeenCalledWith(
      '/barbers/me/shop-location/search',
      expect.objectContaining({ query: 'CutG Studio' }),
    );
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '120 North 3rd Street',
        city: 'Danville',
        latitude: 37.6467,
        longitude: -84.7729,
      }),
    );
  });

  it('reverse-checks a manually moved pin before returning the shop location', async () => {
    vi.spyOn(browserApi, 'post').mockImplementation((path) => {
      if (path !== '/barbers/me/shop-location/reverse-geocode') {
        return Promise.resolve({ suggestions: [], source: 'unavailable' });
      }
      return Promise.resolve({
        addressLine1: '120 North 3rd Street',
        city: 'Danville',
        state: 'KY',
        zipCode: '40422',
        country: 'US',
        latitude: 37.646,
        longitude: -84.773,
        formattedAddress: '120 N 3rd St, Danville, KY 40422, USA',
        source: 'google',
        isApproximateAddress: false,
      });
    });
    const onChange = vi.fn();
    renderEditor(onChange);

    fireEvent.click(screen.getByRole('button', { name: /move shop pin/i }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          address: '120 North 3rd Street',
          latitude: 37.646,
          longitude: -84.773,
          source: 'pin',
        }),
      ),
    );
  });

  it('keeps an exact moved pin when reverse geocoding is unavailable', async () => {
    vi.spyOn(browserApi, 'post').mockRejectedValue(new Error('Maps unavailable'));
    const onChange = vi.fn();

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ShopLocationEditor
          businessName="CutG Studio"
          idPrefix="saved-shop"
          onChange={onChange}
          value={{
            name: 'CutG Studio',
            address: '120 North 3rd Street',
            city: 'Danville',
            state: 'KY',
            zipCode: '40422',
            country: 'US',
            latitude: 37.6467,
            longitude: -84.7729,
            formattedAddress: '120 N 3rd St, Danville, KY 40422',
            source: 'saved',
          }}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /move shop pin/i }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 37.646,
        longitude: -84.773,
        source: 'pin',
      }),
    );
    expect(await screen.findByText(/could not read this pin automatically/i)).toBeTruthy();
  });

  it('uses a fresh precise browser location and reverse geocodes it', async () => {
    vi.spyOn(browserApi, 'post').mockResolvedValue({
      addressLine1: '21 Current Place',
      city: 'Boston',
      state: 'MA',
      zipCode: '02108',
      country: 'US',
      latitude: 42.361,
      longitude: -71.057,
      formattedAddress: '21 Current Place, Boston, MA 02108',
      source: 'google',
      isApproximateAddress: false,
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) =>
          success({
            coords: {
              accuracy: 8,
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
          }),
      },
    });
    const onChange = vi.fn();
    renderEditor(onChange);

    fireEvent.click(screen.getByRole('button', { name: /use my precise location/i }));

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          address: '21 Current Place',
          latitude: 42.361,
          longitude: -71.057,
        }),
      ),
    );
    expect(screen.getByText(/within about 8 metres/i)).toBeTruthy();
  });

  it('lets a barber keep an unmapped address exactly as typed', async () => {
    vi.spyOn(browserApi, 'post').mockResolvedValue({ suggestions: [], source: 'unavailable' });
    const onChange = vi.fn();
    renderEditor(onChange);

    fireEvent.change(screen.getByPlaceholderText(/shop name or full street address/i), {
      target: { value: 'Rear studio beside the blue gate' },
    });
    fireEvent.click(
      await screen.findByRole('option', {
        name: /use “rear studio beside the blue gate” as typed/i,
      }),
    );

    expect(screen.getByLabelText<HTMLInputElement>(/street or suite address/i).value).toBe(
      'Rear studio beside the blue gate',
    );
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        address: 'Rear studio beside the blue gate',
        latitude: 37.6456,
        longitude: -84.7722,
        source: 'pin',
      }),
    );
  });
});
