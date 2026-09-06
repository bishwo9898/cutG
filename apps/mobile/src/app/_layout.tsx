import 'react-native-gesture-handler';

import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { useQuery } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import expoConstants from 'expo-constants';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PaymentProvider } from '@/components/payments/PaymentProvider';
import { mobileApi } from '@/lib/apiClient';
import { cacheBuster, shouldPersistQuery } from '@/lib/cachePolicy';
import { isAuthRejection } from '@/lib/errors';
import { tokenCache } from '@/lib/clerkTokenCache';
import { CACHE_MAX_AGE_MS, queryClient } from '@/lib/queryClient';
import { createFilePersister } from '@/lib/queryPersister';
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
  const setUnreachable = useAuthStore((state) => state.setUnreachable);

  // Read through the query cache rather than fetching by hand, so the answer survives a restart.
  // The cache is persisted, which is what lets a barber open the app on a bad connection and
  // still be themselves: the profile comes off disk while the request is in flight.
  const profile = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: mobileApi.auth.me,
    enabled: isLoaded && isSignedIn === true,
    retry: (failureCount, error) => !isAuthRejection(error) && failureCount < 2,
  });

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setUser(null);
      return;
    }
    if (profile.data !== undefined) {
      setUser(profile.data);
      return;
    }
    // Only a rejection means the account is gone. A timeout or an unreachable server used to
    // land here too and call setUser(null), which sent a signed-in barber back to the welcome
    // screen and asked them to sign in again — with a perfectly good session in secure storage.
    if (!profile.isError) return;
    if (isAuthRejection(profile.error)) setUser(null);
    else setUnreachable();
  }, [isLoaded, isSignedIn, profile.data, profile.isError, profile.error, setUser, setUnreachable]);

  return null;
}

const persister = createFilePersister();
const appVersion = String(expoConstants.expoConfig?.version ?? '0.0.0');

/**
 * Drops the in-memory cache when the signed-in account changes.
 *
 * Query keys name the query, not the account: every barber's dashboard is
 * `['barber','appointments','today']`. Without this, signing out and back in as someone else on
 * the same phone — a shop tablet, a borrowed handset — serves the previous account's customers,
 * names and phone numbers from cache while the new request is still in flight. The disk cache is
 * separated by `cacheBuster`; this is the memory half of the same guarantee.
 *
 * Done during render rather than in an effect so that no screen ever paints the wrong person's
 * data, not even for a single frame.
 */
const useCacheScopedToAccount = (userId: string | null | undefined): void => {
  const previous = useRef<{ id: string | null } | null>(null);
  // `undefined` means Clerk has not said who this is yet. Treating that as "signed out" would
  // clear the cache we have only just restored, on every single launch.
  if (userId === undefined) return;
  if (previous.current !== null && previous.current.id !== userId) {
    queryClient.clear();
  }
  previous.current = { id: userId };
};

function PersistedQueries({
  userId,
  children,
}: {
  userId: string | null;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE_MS,
        buster: cacheBuster(userId, appVersion),
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

function AppShell(): React.ReactElement {
  const user = useAuthStore((state) => state.user);
  const { isLoaded, userId } = useAuth();
  useCacheScopedToAccount(isLoaded ? (userId ?? null) : undefined);

  useEffect(() => {
    if (Platform.OS !== 'web' && user !== null) void reconcileBackgroundLocation();
  }, [user?.id]);

  useEffect(() => listenForNotificationResponses(() => useAuthStore.getState().user), []);

  useEffect(() => {
    if (user !== null) void registerCurrentDevice();
  }, [user?.id]);

  return (
    // The ivory belongs on the root view too: the navigator paints its own light-theme white
    // behind the first screen, so a cold start flashed white between the ivory splash and the
    // ivory app while Clerk finished loading.
    <GestureHandlerRootView style={{ backgroundColor: colors.background, flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <PaymentProvider>
          {isLoaded ? (
            // Restoring before Clerk has said who this is would either discard a signed-in
            // cache as if it belonged to nobody, or hand it to the wrong account. Waiting costs
            // a moment of the spinner the app already shows while Clerk initialises.
            // Keyed so signing in or out tears the persistence layer down and starts a fresh
            // restore under the new buster. Without this the provider keeps the buster it
            // mounted with: signing in on a fresh install wrote the barber's cache tagged
            // `signed-out`, which the next signed-out visitor would happily restore.
            <PersistedQueries key={userId ?? 'signed-out'} userId={userId ?? null}>
              {/* Inside the provider, not beside it: AuthBridge reads /auth/me through the
                  query cache now, which is what lets the profile survive a restart. */}
              <AuthBridge />
              <Stack
                screenOptions={{
                  contentStyle: { backgroundColor: colors.background },
                  headerShown: false,
                }}
              />
            </PersistedQueries>
          ) : (
            <View style={styles.boot}>
              <ActivityIndicator color={colors.accent} />
            </View>
          )}
        </PaymentProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout(): React.ReactElement {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <AppShell />
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
});
