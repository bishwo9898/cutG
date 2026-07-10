import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

import { Button } from './Button';

type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const EmptyState = ({
  icon = 'search',
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps): React.ReactElement => (
  <View style={styles.wrap}>
    <Ionicons color={colors.textMuted} name={icon} size={32} />
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.message}>{message}</Text>
    {actionLabel !== undefined && onAction !== undefined ? (
      <Button title={actionLabel} onPress={onAction} />
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  wrap: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
});
