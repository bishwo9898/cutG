import 'react-native-gesture-handler';

import { StripeProvider } from '@stripe/stripe-react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/lib/queryClient';
import { reconcileBackgroundLocation } from '@/services/backgroundLocation';
import {
  listenForNotificationResponses,
  registerCurrentDevice,
} from '@/services/pushNotifications';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme';

const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

export default function RootLayout(): React.ReactElement {
  const loadStoredAuth = useAuthStore((state) => state.loadStoredAuth);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    void loadStoredAuth().then(() => reconcileBackgroundLocation());
  }, [loadStoredAuth]);

  useEffect(() => listenForNotificationResponses(() => useAuthStore.getState().user), []);

  useEffect(() => {
    if (user !== null) void registerCurrentDevice();
  }, [user?.id]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <StripeProvider
          publishableKey={publishableKey}
          urlScheme="cutg"
          merchantIdentifier="merchant.com.cutg.mobile"
        >
          <QueryClientProvider client={queryClient}>
            <Stack
              screenOptions={{
                contentStyle: { backgroundColor: colors.background },
                headerShown: false,
              }}
            />
          </QueryClientProvider>
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
