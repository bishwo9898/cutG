import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { colors, spacing, typography } from '@/theme';

type InputProps = TextInputProps & {
  label: string;
  error?: string;
  helperText?: string;
};

export const Input = ({
  label,
  error,
  helperText,
  style,
  ...props
}: InputProps): React.ReactElement => (
  <View style={styles.wrap}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      accessibilityLabel={props.accessibilityLabel ?? label}
      placeholderTextColor={colors.textMuted}
      style={[styles.input, error !== undefined && styles.errorBorder, style]}
      {...props}
    />
    {error !== undefined ? (
      <Text accessibilityLiveRegion="polite" role="alert" style={styles.error}>
        {error}
      </Text>
    ) : null}
    {error === undefined && helperText !== undefined ? (
      <Text style={styles.helper}>{helperText}</Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  error: {
    ...typography.caption,
    color: colors.error,
  },
  errorBorder: {
    borderColor: colors.error,
  },
  helper: {
    ...typography.caption,
    color: colors.textMuted,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.textPrimary,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
  },
  wrap: {
    gap: spacing.xs,
  },
});
