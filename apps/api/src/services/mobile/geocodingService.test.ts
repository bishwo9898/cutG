import { describe, expect, it, vi } from 'vitest';

import { reverseGeocodeCoordinates } from './geocodingService';

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
