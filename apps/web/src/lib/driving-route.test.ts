import { describe, expect, it } from 'vitest';

import { drivingRouteUrl, shortestDrivingRoute } from './driving-route';

describe('driving routes', () => {
  it('chooses the shortest valid alternative', () => {
    expect(
      shortestDrivingRoute({
        routes: [
          {
            distance: 1200,
            duration: 90,
            geometry: {
              coordinates: [
                [-84, 37],
                [-83, 38],
              ],
            },
          },
          {
            distance: 800,
            duration: 110,
            geometry: {
              coordinates: [
                [-84, 37],
                [-83.5, 37.5],
              ],
            },
          },
        ],
      }),
    ).toMatchObject({ distanceMeters: 800, durationSeconds: 110 });
  });

  it('rejects malformed route data', () => {
    expect(shortestDrivingRoute({ routes: [{ distance: 10 }] })).toBeNull();
  });

  it('requests alternatives for the selected endpoints', () => {
    expect(
      drivingRouteUrl({ latitude: 37.1, longitude: -84.2 }, { latitude: 37.2, longitude: -84.3 }),
    ).toContain('-84.2,37.1;-84.3,37.2?alternatives=true');
  });
});
