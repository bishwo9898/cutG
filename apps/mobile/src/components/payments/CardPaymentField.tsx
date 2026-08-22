import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

type CardPaymentFieldProps = { onComplete: (complete: boolean) => void };

export const CardPaymentField = ({ onComplete }: CardPaymentFieldProps): React.ReactElement => {
  useEffect(() => onComplete(false), [onComplete]);
  return (
    <View style={styles.notice}>
      <Text style={styles.title}>Secure card entry requires the phone app</Text>
      <Text style={styles.copy}>
        Use an iOS or Android development build to test online payment.
      </Text>
    </View>
  );
};

export const useConfirmCardPayment = (): ((clientSecret: string) => Promise<string | null>) => () =>
  Promise.resolve('Open the iOS or Android app to make a secure card payment.');

const styles = StyleSheet.create({
  copy: { ...typography.bodySmall, color: colors.textSecondary },
  notice: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  title: { ...typography.label, color: colors.textPrimary },
});
