import { StripeProvider } from '@stripe/stripe-react-native';
import type { PropsWithChildren } from 'react';

const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

export const PaymentProvider = ({ children }: PropsWithChildren): React.ReactElement => (
  <StripeProvider
    publishableKey={publishableKey}
    urlScheme="cutg"
    merchantIdentifier="merchant.com.cutg.mobile"
  >
    <>{children}</>
  </StripeProvider>
);
