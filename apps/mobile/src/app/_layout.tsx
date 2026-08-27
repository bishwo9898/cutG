import 'react-native-gesture-handler';

import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PaymentProvider } from '@/components/payments/PaymentProvider';
import { mobileApi } from '@/lib/apiClient';
import { tokenCache } from '@/lib/clerkTokenCache';
import { queryClient } from '@/lib/queryClient';
import { reconcileBackgroundLocation } from '@/services/backgroundLocation';
import {
  listenForNotificationResponses,
  registerCurrentDevice,
} from '@/services/pushNotifications';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme';

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

function AuthBridge(): null {
  const { isLoaded, isSignedIn } = useAuth();
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setUser(null);
      return;
    }

    let cancelled = false;
    void mobileApi.auth
      .me()
      .then((profile) => {
        if (!cancelled) setUser(profile);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });

    return (): void => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, setUser]);

  return null;
}

function AppShell(): React.ReactElement {
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (Platform.OS !== 'web' && user !== null) void reconcileBackgroundLocation();
  }, [user?.id]);

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

export default function RootLayout(): React.ReactElement {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <AuthBridge />
      <AppShell />
    </ClerkProvider>
  );
}
