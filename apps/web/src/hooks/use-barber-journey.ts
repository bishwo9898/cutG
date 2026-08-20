'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { browserApi } from '@/lib/browser-api';
import { errorMessage } from '@/lib/errors';

type LocationPingBody = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  headingDegrees?: number;
  speedMs?: number;
};

type JourneyState = {
  appointmentId: string;
  lastPingAt: string | null;
  warning: string | null;
};

const distanceMeters = (
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number },
): number => {
  const radius = 6_371_000;
  const leftLat = (left.latitude * Math.PI) / 180;
  const rightLat = (right.latitude * Math.PI) / 180;
  const deltaLat = ((right.latitude - left.latitude) * Math.PI) / 180;
  const deltaLon = ((right.longitude - left.longitude) * Math.PI) / 180;
  const value =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(deltaLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const locationBody = (coordinates: GeolocationCoordinates): LocationPingBody => ({
  latitude: coordinates.latitude,
  longitude: coordinates.longitude,
  accuracyMeters: coordinates.accuracy,
  ...(coordinates.heading === null ? {} : { headingDegrees: coordinates.heading }),
  ...(coordinates.speed === null ? {} : { speedMs: Math.max(0, coordinates.speed) }),
});

const currentPosition = (): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    window.navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 5_000,
      timeout: 15_000,
    });
  });

export const useBarberJourney = (): {
  startingId: string | null;
  trackingState: JourneyState | null;
  startJourney: (appointmentId: string) => Promise<boolean>;
  resumeTracking: (appointmentId: string) => Promise<boolean>;
  stopTracking: (appointmentId?: string) => void;
} => {
  const queryClient = useQueryClient();
  const [startingId, setStartingId] = useState<string | null>(null);
  const [trackingState, setTrackingState] = useState<JourneyState | null>(null);
  const watchId = useRef<number | null>(null);
  const activeTrackingId = useRef<string | null>(null);
  const lastPing = useRef<{ at: number; latitude: number; longitude: number } | null>(null);

  const stopTracking = useCallback((appointmentId?: string): void => {
    if (
      appointmentId !== undefined &&
      activeTrackingId.current !== null &&
      activeTrackingId.current !== appointmentId
    ) {
      return;
    }
    if (watchId.current !== null) {
      window.navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    activeTrackingId.current = null;
    lastPing.current = null;
    setTrackingState(null);
  }, []);

  const sendLocationPing = useCallback(
    async (appointmentId: string, coordinates: GeolocationCoordinates): Promise<void> => {
      await browserApi.post(
        `/barbers/me/appointments/${appointmentId}/location`,
        locationBody(coordinates),
      );
      const pingAt = new Date().toISOString();
      lastPing.current = {
        at: Date.now(),
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      };
      setTrackingState({ appointmentId, lastPingAt: pingAt, warning: null });
    },
    [],
  );

  const watch = useCallback(
    (appointmentId: string, coordinates: GeolocationCoordinates, sendInitial: boolean): void => {
      stopTracking();
      activeTrackingId.current = appointmentId;
      lastPing.current = {
        at: Date.now(),
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      };
      setTrackingState({
        appointmentId,
        lastPingAt: new Date().toISOString(),
        warning: null,
      });
      if (sendInitial) {
        void sendLocationPing(appointmentId, coordinates).catch((error: unknown) => {
          setTrackingState({
            appointmentId,
            lastPingAt: null,
            warning: errorMessage(error),
          });
        });
      }
      watchId.current = window.navigator.geolocation.watchPosition(
        (position) => {
          const previous = lastPing.current;
          const next = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          if (
            previous !== null &&
            Date.now() - previous.at < 5_000 &&
            distanceMeters(previous, next) < 20
          ) {
            return;
          }
          void sendLocationPing(appointmentId, position.coords).catch(() => {
            setTrackingState((current) =>
              current?.appointmentId === appointmentId
                ? {
                    ...current,
                    warning: 'Location could not reach the client. Retrying automatically.',
                  }
                : current,
            );
          });
        },
        () => {
          setTrackingState((current) =>
            current?.appointmentId === appointmentId
              ? {
                  ...current,
                  warning: 'Browser location is unavailable. Check site permissions.',
                }
              : current,
          );
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
      );
    },
    [sendLocationPing, stopTracking],
  );

  const prepare = useCallback(
    async (appointmentId: string): Promise<GeolocationPosition | null> => {
      if (!('geolocation' in window.navigator)) {
        setTrackingState({
          appointmentId,
          lastPingAt: null,
          warning: 'This browser does not support live location.',
        });
        return null;
      }
      setStartingId(appointmentId);
      try {
        return await currentPosition();
      } catch {
        setTrackingState({
          appointmentId,
          lastPingAt: null,
          warning: 'Allow precise browser location, then try again.',
        });
        return null;
      } finally {
        setStartingId(null);
      }
    },
    [],
  );

  const startJourney = useCallback(
    async (appointmentId: string): Promise<boolean> => {
      const position = await prepare(appointmentId);
      if (position === null) return false;
      setStartingId(appointmentId);
      try {
        await browserApi.post(
          `/barbers/me/appointments/${appointmentId}/journey/start`,
          locationBody(position.coords),
        );
        watch(appointmentId, position.coords, false);
        await queryClient.invalidateQueries({ queryKey: ['appointments'] });
        return true;
      } catch (error) {
        setTrackingState({ appointmentId, lastPingAt: null, warning: errorMessage(error) });
        return false;
      } finally {
        setStartingId(null);
      }
    },
    [prepare, queryClient, watch],
  );

  const resumeTracking = useCallback(
    async (appointmentId: string): Promise<boolean> => {
      const position = await prepare(appointmentId);
      if (position === null) return false;
      watch(appointmentId, position.coords, true);
      return true;
    },
    [prepare, watch],
  );

  useEffect(() => (): void => stopTracking(), [stopTracking]);

  return { resumeTracking, startJourney, startingId, stopTracking, trackingState };
};
