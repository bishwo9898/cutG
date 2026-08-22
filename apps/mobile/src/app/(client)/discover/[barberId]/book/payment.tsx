import { CardField, useStripe } from '@stripe/stripe-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useCreatePaymentIntent } from '@/hooks/usePayments';
import { errorMessage } from '@/lib/errors';
import { colors, spacing, typography } from '@/theme';

export default function PaymentScreen(): React.ReactElement {
  const { appointmentId = '', total } = useLocalSearchParams<{
    appointmentId?: string;
    total?: string;
  }>();
  const { confirmPayment } = useStripe();
  const createIntent = useCreatePaymentIntent();
  const [cardComplete, setCardComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async (): Promise<void> => {
    setError(null);
    try {
      const intent = await createIntent.mutateAsync(appointmentId);
      const result = await confirmPayment(intent.clientSecret, { paymentMethodType: 'Card' });
      if (result.error !== undefined) {
        setError(result.error.message ?? 'Payment failed. Please try again.');
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
      <CardField
        cardStyle={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: 8,
          textColor: colors.textPrimary,
        }}
        postalCodeEnabled={false}
        style={styles.cardContainer}
        onCardChange={(details: { complete: boolean }) => setCardComplete(details.complete)}
      />
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
  cardContainer: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    height: 52,
    padding: spacing.sm,
  },
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
