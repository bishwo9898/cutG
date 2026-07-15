import { StyleSheet, Text } from 'react-native';

import { colors, spacing, typography } from '@/theme';

import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export const NetworkBanner = (): React.ReactElement | null => {
  const isConnected = useNetworkStatus();
  if (isConnected) return null;
  return <Text style={styles.banner}>No connection. Showing saved data where available.</Text>;
};

const styles = StyleSheet.create({
  banner: {
    ...typography.caption,
    backgroundColor: colors.warning,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlign: 'center',
  },
});
