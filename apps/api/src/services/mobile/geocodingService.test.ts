import { describe, expect, it, vi } from 'vitest';

import {
  reverseGeocodeCoordinates,
  searchMapLocations,
  type ShopLocationSuggestion,
} from './geocodingService';

describe('reverse geocoding', () => {
  it('falls back to exact coordinates when Google rejects the server key', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'REQUEST_DENIED' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );

    await expect(
      reverseGeocodeCoordinates(37.6456, -84.7722, fetcher as typeof fetch),
    ).resolves.toMatchObject({
      addressLine1: 'Pinned service location',
      city: 'Danville',
      isApproximateAddress: true,
      latitude: 37.6456,
      longitude: -84.7722,
      source: 'coordinate_fallback',
      state: 'KY',
    });
  });

  it('falls back to exact coordinates when Google quota is unavailable', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'OVER_QUERY_LIMIT' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );

    await expect(
      reverseGeocodeCoordinates(37.6456, -84.7722, fetcher as typeof fetch),
    ).resolves.toMatchObject({
      formattedAddress: 'Pinned service location near Danville, KY 40422',
      source: 'coordinate_fallback',
    });
  });

  it('falls back to exact coordinates when Google is unreachable', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network down'));

    await expect(
      reverseGeocodeCoordinates(37.6456, -84.7722, fetcher as typeof fetch),
    ).resolves.toMatchObject({
      source: 'coordinate_fallback',
      latitude: 37.6456,
      longitude: -84.7722,
    });
  });

  it('preserves the exact pin while using the closest complete street result', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'OK',
          results: [
            {
              formatted_address: '307 W Broadway St, Danville, KY 40422, USA',
              address_components: [
                { long_name: '307', short_name: '307', types: ['street_number'] },
                {
                  long_name: 'West Broadway Street',
                  short_name: 'W Broadway St',
                  types: ['route'],
                },
                { long_name: 'Danville', short_name: 'Danville', types: ['locality'] },
                {
                  long_name: 'Kentucky',
                  short_name: 'KY',
                  types: ['administrative_area_level_1'],
                },
                { long_name: '40422', short_name: '40422', types: ['postal_code'] },
                { long_name: 'United States', short_name: 'US', types: ['country'] },
              ],
            },
          ],
        }),
        { headers: { 'content-type': 'application/json' }, status: 200 },
      ),
    );

    await expect(
      reverseGeocodeCoordinates(37.6456, -84.7722, fetcher as typeof fetch),
    ).resolves.toMatchObject({
      addressLine1: '307 West Broadway Street',
      city: 'Danville',
      country: 'US',
      isApproximateAddress: false,
      latitude: 37.6456,
      longitude: -84.7722,
      source: 'google',
      state: 'KY',
      zipCode: '40422',
    });
  });
});

describe('shop location search', () => {
  it('finds a business name and maps its structured Google Places address', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          places: [
            {
              id: 'fixture-place',
              displayName: { text: 'Main Street Barbers' },
              formattedAddress: '307 W Broadway St, Danville, KY 40422, USA',
              location: { latitude: 37.6456, longitude: -84.7722 },
              addressComponents: [
                { longText: '307', shortText: '307', types: ['street_number'] },
                {
                  longText: 'West Broadway Street',
                  shortText: 'W Broadway St',
                  types: ['route'],
                },
                { longText: 'Danville', shortText: 'Danville', types: ['locality'] },
                {
                  longText: 'Kentucky',
                  shortText: 'KY',
                  types: ['administrative_area_level_1'],
                },
                { longText: '40422', shortText: '40422', types: ['postal_code'] },
                { longText: 'United States', shortText: 'US', types: ['country'] },
              ],
            },
          ],
        }),
        { headers: { 'content-type': 'application/json' }, status: 200 },
      ),
    );

    const result = await searchMapLocations(
      {
        query: 'Main Street Barbers',
        latitude: 37.6456,
        longitude: -84.7722,
      },
      { fetcher: fetcher as typeof fetch },
    );

    expect(result).toMatchObject({
      source: 'google_places',
      suggestions: [
        {
          placeId: 'fixture-place',
          name: 'Main Street Barbers',
          addressLine1: '307 West Broadway Street',
          city: 'Danville',
          state: 'KY',
          zipCode: '40422',
          latitude: 37.6456,
          longitude: -84.7722,
        },
      ],
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places:searchText',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('falls back to Google Geocoding when Places has no match', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ places: [] }), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'OK',
            results: [
              {
                place_id: 'geocode-place',
                formatted_address: '307 W Broadway St, Danville, KY 40422, USA',
                geometry: { location: { lat: 37.6456, lng: -84.7722 } },
                address_components: [
                  { long_name: '307', short_name: '307', types: ['street_number'] },
                  {
                    long_name: 'West Broadway Street',
                    short_name: 'W Broadway St',
                    types: ['route'],
                  },
                  { long_name: 'Danville', short_name: 'Danville', types: ['locality'] },
                  {
                    long_name: 'Kentucky',
                    short_name: 'KY',
                    types: ['administrative_area_level_1'],
                  },
                  { long_name: '40422', short_name: '40422', types: ['postal_code'] },
                  { long_name: 'United States', short_name: 'US', types: ['country'] },
                ],
              },
            ],
          }),
          { headers: { 'content-type': 'application/json' }, status: 200 },
        ),
      );

    await expect(
      searchMapLocations(
        { query: '307 W Broadway St, Danville, KY' },
        { fetcher: fetcher as typeof fetch },
      ),
    ).resolves.toMatchObject({
      source: 'google_geocoding',
      suggestions: [
        {
          placeId: 'geocode-place',
          addressLine1: '307 West Broadway Street',
          city: 'Danville',
          state: 'KY',
        },
      ],
    });
  });

  it('offers the saved shop address when map providers cannot resolve the text', async () => {
    const saved: ShopLocationSuggestion = {
      name: 'Saved Studio',
      addressLine1: '1 Test Street',
      city: 'Boston',
      state: 'MA',
      zipCode: '02108',
      country: 'US',
      latitude: 42.3601,
      longitude: -71.0589,
      formattedAddress: '1 Test Street, Boston, MA 02108',
      source: 'saved',
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ places: [] }), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ZERO_RESULTS', results: [] }), {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }),
      );

    await expect(
      searchMapLocations(
        { query: 'A shop Google cannot find' },
        { fallback: saved, fetcher: fetcher as typeof fetch },
      ),
    ).resolves.toEqual({ suggestions: [saved], source: 'saved' });
  });
});
