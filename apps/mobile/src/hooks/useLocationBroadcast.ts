import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { mobileApi } from '@/lib/apiClient';

export const useLocationBroadcast = (appointmentId: string, status?: string): void => {
  const subscription = useRef<Location.LocationSubscription | null>(null);
  const permissionExplained = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const stop = (): void => {
      subscription.current?.remove();
      subscription.current = null;
    };
    const start = async (): Promise<void> => {
      stop();
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        if (!permissionExplained.current) {
          permissionExplained.current = true;
          Alert.alert(
            'Location required',
            'Allow location access to share your journey with the client. You can still update the appointment without tracking.',
          );
        }
        return;
      }
      const watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 20,
          timeInterval: 15_000,
        },
        (location) => {
          const body = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            ...(location.coords.accuracy === null
              ? {}
              : { accuracyMeters: location.coords.accuracy }),
            ...(location.coords.heading === null
              ? {}
              : { headingDegrees: location.coords.heading }),
            ...(location.coords.speed === null
              ? {}
              : { speedMs: Math.max(0, location.coords.speed) }),
          };
          void mobileApi.barber.sendLocationPing(appointmentId, body).catch(() => undefined);
        },
      );
      if (cancelled) watcher.remove();
      else subscription.current = watcher;
    };
    if (status === 'ON_THE_WAY' && appointmentId.length > 0) void start();
    else stop();
    return (): void => {
      cancelled = true;
      stop();
    };
  }, [appointmentId, status]);
};
