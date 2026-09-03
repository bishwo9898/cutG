import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

type BadgeProps = {
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'gold' | 'arrived' | 'completed';
  /**
   * Each tone carries a default glyph chosen for the appointment status it names — `info` means
   * ON_THE_WAY, so it draws a navigation arrow. Callers borrowing a tone for its colour alone
   * should pass their own glyph, or the badge says something the label does not.
   */
  icon?: keyof typeof Ionicons.glyphMap;
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

export const Badge = ({ label, tone = 'default', icon }: BadgeProps): React.ReactElement => (
  <View
    accessibilityLabel={label}
    style={[
      styles.badge,
      { backgroundColor: toneColors[tone].background, borderColor: toneColors[tone].border },
    ]}
  >
    <Ionicons
      color={toneColors[tone].text}
      name={
        icon ??
        (tone === 'success'
          ? 'checkmark-circle'
          : tone === 'warning'
            ? 'time'
            : tone === 'error'
              ? 'alert-circle'
              : tone === 'info'
                ? 'navigate-circle'
                : tone === 'arrived'
                  ? 'location'
                  : tone === 'completed'
                    ? 'checkmark-done-circle'
                    : tone === 'gold'
                      ? 'cut'
                      : 'ellipse')
      }
      size={14}
    />
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
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  text: {
    ...typography.caption,
    fontWeight: '700',
  },
});
