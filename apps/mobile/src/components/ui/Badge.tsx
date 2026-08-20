import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

type BadgeProps = {
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'gold' | 'arrived' | 'completed';
};

const toneColors = {
  default: {
    background: colors.surfaceRaised,
    border: colors.borderLight,
    text: colors.textPrimary,
  },
  error: {
    background: colors.statusCancelledSurface,
    border: colors.statusCancelled,
    text: colors.statusCancelled,
  },
  gold: {
    background: colors.statusInProgressSurface,
    border: colors.statusInProgress,
    text: colors.statusInProgress,
  },
  info: {
    background: colors.statusOnTheWaySurface,
    border: colors.statusOnTheWay,
    text: colors.statusOnTheWay,
  },
  success: {
    background: colors.statusConfirmedSurface,
    border: colors.statusConfirmed,
    text: colors.statusConfirmed,
  },
  warning: {
    background: colors.statusPendingSurface,
    border: colors.statusPending,
    text: colors.statusPending,
  },
  arrived: {
    background: colors.statusArrivedSurface,
    border: colors.statusArrived,
    text: colors.statusArrived,
  },
  completed: {
    background: colors.statusCompletedSurface,
    border: colors.statusCompleted,
    text: colors.statusCompleted,
  },
};

export const Badge = ({ label, tone = 'default' }: BadgeProps): React.ReactElement => (
  <View
    style={[
      styles.badge,
      { backgroundColor: toneColors[tone].background, borderColor: toneColors[tone].border },
    ]}
  >
    <Text style={[styles.text, { color: toneColors[tone].text }]}>{label}</Text>
  </View>
);

export const statusTone = (status: string): BadgeProps['tone'] => {
  if (status === 'CONFIRMED' || status === 'SUCCEEDED') return 'success';
  if (status === 'COMPLETED') return 'completed';
  if (status === 'PENDING') return 'warning';
  if (status === 'CANCELLED' || status === 'NO_SHOW' || status === 'FAILED') return 'error';
  if (status === 'ON_THE_WAY') return 'info';
  if (status === 'ARRIVED') return 'arrived';
  if (status === 'IN_PROGRESS') return 'gold';
  return 'default';
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  text: {
    ...typography.caption,
    fontWeight: '700',
  },
});
