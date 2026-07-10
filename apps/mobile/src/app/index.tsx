import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuthStore } from '@/store/authStore';
import { colors } from '@/theme';

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
  if (user?.userType === 'BARBER') return <Redirect href="/(barber)/today" />;
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
