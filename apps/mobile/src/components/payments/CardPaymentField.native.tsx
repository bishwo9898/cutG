import { CardField, useStripe } from '@stripe/stripe-react-native';
import { StyleSheet } from 'react-native';

import { colors, spacing } from '@/theme';

type CardPaymentFieldProps = { onComplete: (complete: boolean) => void };

export const CardPaymentField = ({ onComplete }: CardPaymentFieldProps): React.ReactElement => (
  <CardField
    cardStyle={{
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      textColor: colors.textPrimary,
    }}
    postalCodeEnabled={false}
    style={styles.cardContainer}
    onCardChange={(details) => onComplete(details.complete)}
  />
);

export const useConfirmCardPayment = (): ((clientSecret: string) => Promise<string | null>) => {
  const { confirmPayment } = useStripe();
  return async (clientSecret) => {
    const result = await confirmPayment(clientSecret, { paymentMethodType: 'Card' });
    return result.error?.message ?? null;
  };
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    height: 52,
    padding: spacing.sm,
  },
});
