import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { mobileApi } from '@/lib/apiClient';

export type LocationBroadcastState = {
  state: 'idle' | 'requesting' | 'active' | 'error';
  lastPingAt: string | null;
  message: string;
};

const idleState: LocationBroadcastState = {
  state: 'idle',
  lastPingAt: null,
  message: 'Location sharing starts with the journey.',
};

export const useLocationBroadcast = (
  appointmentId: string,
  status?: string,
): LocationBroadcastState => {
  const subscription = useRef<Location.LocationSubscription | null>(null);
  const permissionExplained = useRef(false);
  const [broadcast, setBroadcast] = useState<LocationBroadcastState>(idleState);

  useEffect(() => {
    let cancelled = false;
    const stop = (): void => {
      subscription.current?.remove();
      subscription.current = null;
    };
    const start = async (): Promise<void> => {
      stop();
      setBroadcast({
        state: 'requesting',
        lastPingAt: null,
        message: 'Starting precise location sharing…',
      });
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setBroadcast({
          state: 'error',
          lastPingAt: null,
          message: 'Precise location permission is required before starting the test journey.',
        });
        if (!permissionExplained.current) {
          permissionExplained.current = true;
          Alert.alert(
            'Location required',
            'Allow precise location to share your journey with the client. The test journey should not start without tracking.',
          );
        }
        return;
      }
      const send = async (location: Location.LocationObject): Promise<void> => {
        const body = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          ...(location.coords.accuracy === null
            ? {}
            : { accuracyMeters: location.coords.accuracy }),
          ...(location.coords.heading === null ? {} : { headingDegrees: location.coords.heading }),
          ...(location.coords.speed === null
            ? {}
            : { speedMs: Math.max(0, location.coords.speed) }),
        };
        try {
          await mobileApi.barber.sendLocationPing(appointmentId, body);
          if (!cancelled) {
            setBroadcast({
              state: 'active',
              lastPingAt: new Date().toISOString(),
              message: 'Live location is reaching the client.',
            });
          }
        } catch {
          if (!cancelled) {
            setBroadcast({
              state: 'error',
              lastPingAt: null,
              message: 'Location could not reach the server. The next GPS update will retry.',
            });
          }
        }
      };
      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      await send(initialLocation);
      const watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 10_000,
        },
        (location) => {
          void send(location);
        },
      );
      if (cancelled) watcher.remove();
      else subscription.current = watcher;
    };
    if (status === 'ON_THE_WAY' && appointmentId.length > 0) {
      void start().catch(() => {
        if (!cancelled) {
          setBroadcast({
            state: 'error',
            lastPingAt: null,
            message: 'Location sharing could not start. Check device permissions and try again.',
          });
        }
      });
    } else {
      stop();
      setBroadcast(idleState);
    }
    return (): void => {
      cancelled = true;
      stop();
    };
  }, [appointmentId, status]);

  return broadcast;
};
