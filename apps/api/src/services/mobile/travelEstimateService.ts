import { env } from '../../config/env';
export type Coordinates = { latitude: number; longitude: number };
export type TravelMetrics = {
  distanceMiles: number;
  travelMinutes: number;
  source: 'google' | 'mock';
};

type DistanceMatrixResponse = {
  status?: string;
  rows?: Array<{
    elements?: Array<{
      status?: string;
      distance?: { value?: number };
      duration?: { value?: number };
    }>;
  }>;
};

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

export const straightLineMiles = (origin: Coordinates, destination: Coordinates): number => {
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = radians(destination.latitude - origin.latitude);
  const longitudeDelta = radians(destination.longitude - origin.longitude);
  const latitude1 = radians(origin.latitude);
  const latitude2 = radians(destination.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const mockDistance = (origin: Coordinates, destination: Coordinates): TravelMetrics => {
  const distanceMiles = Number((straightLineMiles(origin, destination) * 1.2).toFixed(2));
  return {
    distanceMiles,
    travelMinutes: Math.max(1, Math.ceil((distanceMiles / 25) * 60)),
    source: 'mock',
  };
};

export const getTravelMetrics = async (
  origin: Coordinates,
  destination: Coordinates,
  fetcher: typeof fetch = fetch,
): Promise<TravelMetrics> => {
  if (env.GOOGLE_MAPS_API_KEY.length === 0 || env.NODE_ENV === 'test') {
    return mockDistance(origin, destination);
  }

  const parameters = new URLSearchParams({
    origins: `${origin.latitude},${origin.longitude}`,
    destinations: `${destination.latitude},${destination.longitude}`,
    mode: 'driving',
    departure_time: 'now',
    key: env.GOOGLE_MAPS_API_KEY,
  });
  let response: Response;
  try {
    response = await fetcher(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${parameters.toString()}`,
    );
  } catch {
    return mockDistance(origin, destination);
  }
  const body = (await response.json()) as DistanceMatrixResponse;
  const element = body.rows?.[0]?.elements?.[0];
  if (!response.ok || body.status !== 'OK' || element?.status !== 'OK') {
    return mockDistance(origin, destination);
  }
  const meters = element.distance?.value;
  const seconds = element.duration?.value;
  if (meters === undefined || seconds === undefined) {
    return mockDistance(origin, destination);
  }
  return {
    distanceMiles: Number((meters / 1609.344).toFixed(2)),
    travelMinutes: Math.max(1, Math.ceil(seconds / 60)),
    source: 'google',
  };
};
