import 'react-native-gesture-handler';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/lib/queryClient';
import { PaymentProvider } from '@/components/payments/PaymentProvider';
import { reconcileBackgroundLocation } from '@/services/backgroundLocation';
import {
  listenForNotificationResponses,
  registerCurrentDevice,
} from '@/services/pushNotifications';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme';

export default function RootLayout(): React.ReactElement {
  const loadStoredAuth = useAuthStore((state) => state.loadStoredAuth);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    void loadStoredAuth().then(() => {
      if (Platform.OS !== 'web') return reconcileBackgroundLocation();
    });
  }, [loadStoredAuth]);

  useEffect(() => listenForNotificationResponses(() => useAuthStore.getState().user), []);

  useEffect(() => {
    if (user !== null) void registerCurrentDevice();
  }, [user?.id]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <PaymentProvider>
          <QueryClientProvider client={queryClient}>
            <Stack
              screenOptions={{
                contentStyle: { backgroundColor: colors.background },
                headerShown: false,
              }}
            />
          </QueryClientProvider>
        </PaymentProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
