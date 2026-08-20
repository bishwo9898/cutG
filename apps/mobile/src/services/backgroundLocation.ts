import { ApiError } from '@barber-saas/api-client';
import type { LocationPingRequest, StartJourneyResponse } from '@barber-saas/shared-types';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';

import { mobileApi } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import {
  ACTIVE_APPOINTMENT_KEY,
  clearTrackingStorage,
  LAST_ERROR_KEY,
  LAST_PING_KEY,
  LOCATION_TASK,
  PENDING_LOCATION_KEY,
  stopBackgroundLocationTracking,
} from '@/services/locationTrackingStorage';

type LocationTaskData = { locations: Location.LocationObject[] };

const toPing = (location: Location.LocationObject): LocationPingRequest => ({
  latitude: location.coords.latitude,
  longitude: location.coords.longitude,
  ...(location.coords.accuracy === null ? {} : { accuracyMeters: location.coords.accuracy }),
  ...(location.coords.heading === null ? {} : { headingDegrees: location.coords.heading }),
  ...(location.coords.speed === null ? {} : { speedMs: Math.max(0, location.coords.speed) }),
});

export { stopBackgroundLocationTracking } from '@/services/locationTrackingStorage';

const ensureStoredAuth = async (): Promise<boolean> => {
  if (useAuthStore.getState().accessToken === null) {
    await useAuthStore.getState().loadStoredAuth();
  }
  return useAuthStore.getState().accessToken !== null;
};

const recordLocation = async (
  appointmentId: string,
  location: Location.LocationObject,
): Promise<void> => {
  const ping = toPing(location);
  try {
    if (!(await ensureStoredAuth())) {
      await stopBackgroundLocationTracking();
      return;
    }
    await mobileApi.barber.sendLocationPing(appointmentId, ping);
    await Promise.all([
      SecureStore.setItemAsync(LAST_PING_KEY, new Date().toISOString()),
      SecureStore.deleteItemAsync(LAST_ERROR_KEY),
      SecureStore.deleteItemAsync(PENDING_LOCATION_KEY),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'TRACKING_NOT_ACTIVE') {
      await stopBackgroundLocationTracking();
      return;
    }
    await Promise.all([
      SecureStore.setItemAsync(PENDING_LOCATION_KEY, JSON.stringify(ping)),
      SecureStore.setItemAsync(
        LAST_ERROR_KEY,
        'Location could not reach the server. cutG will retry with the newest update.',
      ),
    ]);
  }
};

const handleLocationTask = async ({
  data,
  error,
}: TaskManager.TaskManagerTaskBody<LocationTaskData>): Promise<void> => {
  if (error !== null) {
    await SecureStore.setItemAsync(LAST_ERROR_KEY, error.message);
    return;
  }
  const appointmentId = await SecureStore.getItemAsync(ACTIVE_APPOINTMENT_KEY);
  const latest = data?.locations.at(-1);
  if (appointmentId === null || latest === undefined) return;
  await recordLocation(appointmentId, latest);
};

if (!TaskManager.isTaskDefined(LOCATION_TASK)) {
  // TaskManager must receive the promise so the native background execution window
  // remains open until the newest location has reached secure storage or the API.
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  TaskManager.defineTask<LocationTaskData>(LOCATION_TASK, (body): Promise<void> =>
    handleLocationTask(body),
  );
}

const registerTask = async (appointmentId: string): Promise<void> => {
  const currentAppointmentId = await SecureStore.getItemAsync(ACTIVE_APPOINTMENT_KEY);
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (alreadyStarted && currentAppointmentId !== appointmentId) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
  await SecureStore.setItemAsync(ACTIVE_APPOINTMENT_KEY, appointmentId);
  if (!alreadyStarted || currentAppointmentId !== appointmentId) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      activityType: Location.ActivityType.AutomotiveNavigation,
      distanceInterval: 10,
      timeInterval: 10_000,
      deferredUpdatesDistance: 10,
      deferredUpdatesInterval: 10_000,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'cutG journey sharing',
        notificationBody: 'Your live location is being shared with your client until arrival.',
        notificationColor: '#315D7A',
      },
    });
  }
};

export const startBackgroundJourney = async (
  appointmentId: string,
  initialLocation: Location.LocationObject,
): Promise<StartJourneyResponse> => {
  await registerTask(appointmentId);
  try {
    const response = await mobileApi.barber.startJourney(appointmentId, toPing(initialLocation));
    await Promise.all([
      SecureStore.setItemAsync(LAST_PING_KEY, response.tracking.lastPingAt),
      SecureStore.deleteItemAsync(LAST_ERROR_KEY),
      SecureStore.deleteItemAsync(PENDING_LOCATION_KEY),
    ]);
    return response;
  } catch (error) {
    await stopBackgroundLocationTracking();
    throw error;
  }
};

export const getBackgroundTrackingSnapshot = async (): Promise<{
  appointmentId: string | null;
  active: boolean;
  lastPingAt: string | null;
  error: string | null;
}> => {
  const [appointmentId, lastPingAt, error, active] = await Promise.all([
    SecureStore.getItemAsync(ACTIVE_APPOINTMENT_KEY),
    SecureStore.getItemAsync(LAST_PING_KEY),
    SecureStore.getItemAsync(LAST_ERROR_KEY),
    Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false),
  ]);
  return { active, appointmentId, error, lastPingAt };
};

export const reconcileBackgroundLocation = async (): Promise<void> => {
  const snapshot = await getBackgroundTrackingSnapshot();
  if (!snapshot.active) {
    if (snapshot.appointmentId !== null) await clearTrackingStorage();
    return;
  }
  if (snapshot.appointmentId === null || !(await ensureStoredAuth())) {
    await stopBackgroundLocationTracking();
    return;
  }
  try {
    const appointment = await mobileApi.barber.appointment(snapshot.appointmentId);
    if (appointment.status !== 'ON_THE_WAY') await stopBackgroundLocationTracking();
  } catch (error) {
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
      await stopBackgroundLocationTracking();
    }
  }
};
