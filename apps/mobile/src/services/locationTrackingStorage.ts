import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';

export const LOCATION_TASK = 'cutg-barber-journey-location';
export const ACTIVE_APPOINTMENT_KEY = 'cutg.activeJourneyAppointment';
export const LAST_PING_KEY = 'cutg.activeJourneyLastPing';
export const LAST_ERROR_KEY = 'cutg.activeJourneyLastError';
export const PENDING_LOCATION_KEY = 'cutg.activeJourneyPendingLocation';

export const clearTrackingStorage = async (): Promise<void> => {
  await Promise.all([
    SecureStore.deleteItemAsync(ACTIVE_APPOINTMENT_KEY),
    SecureStore.deleteItemAsync(LAST_PING_KEY),
    SecureStore.deleteItemAsync(LAST_ERROR_KEY),
    SecureStore.deleteItemAsync(PENDING_LOCATION_KEY),
  ]);
};

export const stopBackgroundLocationTracking = async (): Promise<void> => {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (started) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  } finally {
    await clearTrackingStorage();
  }
};
