import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

export const LoadingSpinner = (): React.ReactElement => (
  <View style={styles.wrap}>
    <ActivityIndicator color={colors.accent} />
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    padding: spacing.lg,
  },
});
