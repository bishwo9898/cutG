import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@barber-saas/api-client';
import { mobileApi } from '@/lib/apiClient';

const BarberEntry = (): React.ReactElement => {
  const profile = useQuery({
    queryKey: ['barber', 'profile', 'entry'],
    queryFn: mobileApi.barber.profile,
    retry: false,
  });
  if (profile.isLoading)
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  if (profile.error instanceof ApiError && profile.error.status === 404)
    return <Redirect href="/(barber)/setup" />;
  return <Redirect href="/(barber)/today" />;
};

export default function IndexRoute(): React.ReactElement {
  const { isLoading, user } = useAuthStore();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (user?.userType === 'CLIENT') return <Redirect href="/(client)/discover" />;
  if (user?.userType === 'BARBER') return <BarberEntry />;
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
