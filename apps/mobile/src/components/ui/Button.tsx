import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { colors, spacing, typography } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  icon?: ReactNode;
  loading?: boolean;
};

export const Button = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  icon,
  loading = false,
}: ButtonProps): React.ReactElement => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ busy: loading, disabled: disabled || loading }}
    disabled={disabled || loading}
    onPress={() => {
      void Haptics.selectionAsync();
      onPress?.();
    }}
    style={({ pressed }) => [
      styles.base,
      styles[variant],
      disabled && styles.disabled,
      pressed && !disabled && styles.pressed,
    ]}
  >
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'primary' || variant === 'danger' ? colors.textOnAccent : colors.textPrimary
          }
        />
      ) : (
        icon
      )}
      <Text
        style={[
          styles.text,
          (variant === 'secondary' || variant === 'ghost') && styles.secondaryText,
        ]}
      >
        {title}
      </Text>
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: 999,
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  danger: {
    backgroundColor: colors.error,
  },
  disabled: {
    opacity: 0.45,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  secondaryText: {
    color: colors.textPrimary,
  },
  pressed: {
    opacity: 0.8,
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
    borderWidth: 1,
  },
  text: {
    ...typography.button,
    color: colors.textOnAccent,
  },
});
