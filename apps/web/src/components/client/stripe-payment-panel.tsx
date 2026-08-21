'use client';

import { paymentApi } from '@barber-saas/api-client';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { CreditCard, LockKeyhole } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Notice } from '@/components/notice';
import { browserApi } from '@/lib/browser-api';

type PaymentState = { status: string };

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function CheckoutForm({
  amount,
  appointmentId,
  onComplete,
}: {
  amount: number;
  appointmentId: string;
  onComplete: (confirmed: boolean) => void;
}): React.ReactElement {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    if (stripe === null || elements === null) return;
    setSubmitting(true);
    setError(null);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/client/appointments/${appointmentId}?payment=success`,
      },
      redirect: 'if_required',
    });
    if (result.error !== undefined) {
      setSubmitting(false);
      setError(result.error.message ?? 'Your payment could not be completed.');
      return;
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const state = await paymentApi.appointmentStatus<PaymentState>(browserApi, appointmentId);
      if (state.status === 'SUCCEEDED') {
        onComplete(true);
        return;
      }
      await wait(1_000);
    }
    onComplete(false);
  };

  return (
    <div className="stripe-checkout-form">
      <PaymentElement options={{ layout: 'tabs' }} />
      <button
        className="button button-primary button-full"
        disabled={stripe === null || elements === null || submitting}
        onClick={() => void submit()}
        type="button"
      >
        <LockKeyhole size={16} />
        {submitting ? 'Processing securely...' : `Pay $${amount.toFixed(2)}`}
      </button>
      {error !== null && <Notice>{error}</Notice>}
    </div>
  );
}

export function StripePaymentPanel({
  amount,
  appointmentId,
  clientSecret,
  onComplete,
  publishableKey,
}: {
  amount: number;
  appointmentId: string;
  clientSecret: string;
  onComplete: (confirmed: boolean) => void;
  publishableKey: string;
}): React.ReactElement {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);
  return (
    <section className="stripe-payment-panel">
      <div className="stripe-payment-heading">
        <CreditCard size={20} />
        <div>
          <strong>Secure card payment</strong>
          <span>Your card details are encrypted and are never stored by cutG.</span>
        </div>
      </div>
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: {
            theme: 'night',
            variables: {
              colorPrimary: '#d7b968',
              colorBackground: '#151512',
              colorText: '#f3eddc',
              colorDanger: '#df7d73',
              borderRadius: '6px',
            },
          },
        }}
      >
        <CheckoutForm amount={amount} appointmentId={appointmentId} onComplete={onComplete} />
      </Elements>
    </section>
  );
}
