import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CardPaymentField, useConfirmCardPayment } from '@/components/payments/CardPaymentField';
import { useCreatePaymentIntent } from '@/hooks/usePayments';
import { errorMessage } from '@/lib/errors';
import { colors, spacing, typography } from '@/theme';

export default function PaymentScreen(): React.ReactElement {
  const { appointmentId = '', total } = useLocalSearchParams<{
    appointmentId?: string;
    total?: string;
  }>();
  const confirmPayment = useConfirmCardPayment();
  const createIntent = useCreatePaymentIntent();
  const [cardComplete, setCardComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async (): Promise<void> => {
    setError(null);
    try {
      const intent = await createIntent.mutateAsync(appointmentId);
      const paymentError = await confirmPayment(intent.clientSecret);
      if (paymentError !== null) {
        setError(paymentError);
        return;
      }
      router.replace('/(client)/appointments/' + appointmentId + '?paymentSuccess=true');
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  return (
    <Screen>
      <ScreenHeader showBack title="Payment" subtitle="Enter your test card details securely." />
      <Card>
        <Text style={styles.title}>Secure card payment</Text>
        {total !== undefined ? <Text style={styles.amount}>Total ${total}</Text> : null}
        <Text style={styles.meta}>
          Your payment status will update automatically after confirmation.
        </Text>
      </Card>
      <CardPaymentField onComplete={setCardComplete} />
      {error !== null ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        disabled={!cardComplete || createIntent.isPending}
        title={createIntent.isPending ? 'Processing...' : 'Pay now'}
        onPress={() => {
          void pay();
        }}
      />
      <Button
        title="Pay at shop instead"
        variant="ghost"
        onPress={() => router.replace('/(client)/appointments/' + appointmentId)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  amount: {
    ...typography.h2,
    color: colors.gold,
    marginTop: spacing.sm,
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
  },
  meta: {
    ...typography.body,
    color: colors.textSecondary,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
});
