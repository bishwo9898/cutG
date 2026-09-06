import { useAuth } from '@clerk/clerk-expo';
import { ApiError } from '@barber-saas/api-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { mobileApi } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme';

const Loading = (): React.ReactElement => (
  <View style={styles.loading}>
    <ActivityIndicator color={colors.accent} />
  </View>
);

const BarberEntry = (): React.ReactElement => {
  const profile = useQuery({
    queryKey: ['barber', 'profile', 'entry'],
    queryFn: mobileApi.barber.profile,
    retry: false,
  });
  if (profile.isLoading) return <Loading />;
  if (profile.error instanceof ApiError && profile.error.status === 404)
    return <Redirect href="/(barber)/setup" />;
  return <Redirect href="/(barber)/today" />;
};

export default function IndexRoute(): React.ReactElement {
  const { isSignedIn } = useAuth();
  const { isLoading, reachable, user } = useAuthStore();
  const queryClient = useQueryClient();

  if (isLoading) return <Loading />;

  if (user?.userType === 'CLIENT') return <Redirect href="/(client)/discover" />;
  if (user?.userType === 'BARBER') return <BarberEntry />;

  // Signed in as far as Clerk is concerned, but the account could not be loaded and nothing was
  // cached from a previous launch. Sending them to the welcome screen here would be a lie — it
  // reads as "your account is gone" when the truth is only that the phone is offline.
  if (isSignedIn === true && !reachable) {
    return (
      <View style={styles.loading}>
        <EmptyState
          icon="cloud-offline"
          title="Can't reach cutG"
          message="You are still signed in. Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void queryClient.refetchQueries({ queryKey: ['auth', 'me'] })}
        />
      </View>
    );
  }

  return <Redirect href="/(auth)/welcome" />;
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
});
