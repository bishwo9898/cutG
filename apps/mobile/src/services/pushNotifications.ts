import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import ExpoConstants from 'expo-constants';
import { router } from 'expo-router';
import { Alert, Platform } from 'react-native';

import { mobileApi } from '@/lib/apiClient';
import { notificationDestination } from '@/lib/notificationNavigation';
import * as SecureStore from '@/lib/secureStorage';
import type { AuthUser } from '@/lib/types';

const INSTALLATION_KEY = 'cutg.pushInstallationId';
const PROMPTED_KEY = 'cutg.pushPermissionPrompted';
const pushNotificationsEnabled = process.env.EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS !== 'false';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
  });
}

const installationId = async (): Promise<string> => {
  const existing = await SecureStore.getItemAsync(INSTALLATION_KEY);
  if (existing !== null) return existing;
  const created = Crypto.randomUUID();
  await SecureStore.setItemAsync(INSTALLATION_KEY, created);
  return created;
};

const explainNotifications = (): Promise<boolean> =>
  new Promise((resolve) => {
    Alert.alert(
      'Stay up to date',
      'Allow cutG to alert you about bookings, journey progress, arrivals, cancellations, and payments.',
      [
        { text: 'Not now', style: 'cancel', onPress: (): void => resolve(false) },
        { text: 'Allow alerts', onPress: (): void => resolve(true) },
      ],
      { cancelable: true, onDismiss: (): void => resolve(false) },
    );
  });

export const registerCurrentDevice = async (): Promise<void> => {
  if (Platform.OS === 'web' || !pushNotificationsEnabled) return;
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted) {
    const prompted = await SecureStore.getItemAsync(PROMPTED_KEY);
    if (prompted !== null || !(await explainNotifications())) return;
    await SecureStore.setItemAsync(PROMPTED_KEY, 'true');
    granted = (await Notifications.requestPermissionsAsync()).granted;
  }
  if (!granted) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('appointments', {
      name: 'Appointments',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
    });
  }
  const projectId =
    ExpoConstants.easConfig?.projectId ??
    (ExpoConstants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (projectId === undefined || projectId.length === 0) return;
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await mobileApi.notifications.registerDevice({
    installationId: await installationId(),
    expoPushToken: token.data,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    appVersion: ExpoConstants.expoConfig?.version ?? '0.2.0',
  });
};

export const unregisterCurrentDevice = async (): Promise<void> => {
  const id = await SecureStore.getItemAsync(INSTALLATION_KEY);
  if (id !== null) await mobileApi.notifications.unregisterDevice(id).catch(() => undefined);
};

const openNotification = (data: Record<string, unknown>, user: AuthUser | null): void => {
  router.push(notificationDestination(data, user));
};

export const listenForNotificationResponses = (getUser: () => AuthUser | null): (() => void) => {
  if (Platform.OS === 'web') return () => undefined;
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    openNotification(response.notification.request.content.data ?? {}, getUser());
  });
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response !== null)
      openNotification(response.notification.request.content.data ?? {}, getUser());
  });
  return () => subscription.remove();
};
