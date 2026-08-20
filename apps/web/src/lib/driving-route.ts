export type DrivingRoute = {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
};

type RouteApiResponse = {
  routes?: Array<{
    distance?: unknown;
    duration?: unknown;
    geometry?: { coordinates?: unknown };
  }>;
};

const coordinatesAreValid = (value: unknown): value is [number, number][] =>
  Array.isArray(value) &&
  value.length >= 2 &&
  value.every(
    (point) =>
      Array.isArray(point) &&
      point.length >= 2 &&
      typeof point[0] === 'number' &&
      typeof point[1] === 'number' &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]),
  );

export const shortestDrivingRoute = (value: unknown): DrivingRoute | null => {
  if (value === null || typeof value !== 'object') return null;
  const routes = (value as RouteApiResponse).routes;
  if (!Array.isArray(routes)) return null;

  const validRoutes = routes.flatMap((route) => {
    const coordinates = route.geometry?.coordinates;
    if (
      typeof route.distance !== 'number' ||
      !Number.isFinite(route.distance) ||
      typeof route.duration !== 'number' ||
      !Number.isFinite(route.duration) ||
      !coordinatesAreValid(coordinates)
    ) {
      return [];
    }
    return [
      {
        coordinates,
        distanceMeters: route.distance,
        durationSeconds: route.duration,
      },
    ];
  });

  return validRoutes.sort((left, right) => left.distanceMeters - right.distanceMeters)[0] ?? null;
};

export const drivingRouteUrl = (
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
): string =>
  `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?alternatives=true&overview=full&geometries=geojson&steps=false`;
