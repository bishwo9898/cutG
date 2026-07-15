import { describe, expect, it, vi } from 'vitest';

import { reverseGeocodeCoordinates } from './geocodingService';

describe('reverse geocoding', () => {
  it('maps a Google key restriction to a configuration error', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'REQUEST_DENIED' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );

    await expect(
      reverseGeocodeCoordinates(37.6456, -84.7722, fetcher as typeof fetch),
    ).rejects.toMatchObject({ code: 'MAPS_NOT_CONFIGURED', statusCode: 503 });
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
      latitude: 37.6456,
      longitude: -84.7722,
      state: 'KY',
      zipCode: '40422',
    });
  });
});
