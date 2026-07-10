import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

type BadgeProps = {
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'gold';
};

const toneColors = {
  default: colors.surfaceRaised,
  error: colors.error,
  gold: colors.gold,
  info: colors.info,
  success: colors.success,
  warning: colors.warning,
};

export const Badge = ({ label, tone = 'default' }: BadgeProps): React.ReactElement => (
  <View style={[styles.badge, { backgroundColor: toneColors[tone] }]}>
    <Text style={styles.text}>{label}</Text>
  </View>
);

export const statusTone = (status: string): BadgeProps['tone'] => {
  if (status === 'CONFIRMED' || status === 'COMPLETED' || status === 'SUCCEEDED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'CANCELLED' || status === 'FAILED') return 'error';
  if (status === 'IN_PROGRESS') return 'info';
  return 'default';
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  text: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
