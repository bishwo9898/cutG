'use client';

import { barberBillingApi } from '@barber-saas/api-client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';

import { Notice } from '@/components/notice';
import { browserApi } from '@/lib/browser-api';

type StripeStatus = {
  stripeAccountId: string | null;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requiresAction: boolean;
  message?: string;
};
type ConnectResponse = { onboardingUrl: string; stripeAccountId: string; message: string };

export default function DashboardPaymentsPage(): React.ReactElement {
  const status = useQuery({
    queryKey: ['stripe-status'],
    queryFn: () => barberBillingApi.stripeStatus<StripeStatus>(browserApi),
  });
  const connect = useMutation({
    mutationFn: () => barberBillingApi.connectStripe<ConnectResponse>(browserApi),
    onSuccess: (response) => {
      window.location.href = response.onboardingUrl;
    },
  });

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Payments</span>
          <h1>Stripe setup</h1>
          <p>Connect Stripe to accept card payments and receive payouts.</p>
        </div>
      </div>
      <section className="panel">
        <div className="panel-header">
          <h2>Connect status</h2>
          <CreditCard size={20} />
        </div>
        <div className="panel-body form-stack">
          <p>
            <strong>Account:</strong> {status.data?.stripeAccountId ?? 'Not started'}
          </p>
          <p>
            <strong>Onboarding:</strong>{' '}
            {status.data?.onboardingComplete === true ? 'Complete' : 'Action required'}
          </p>
          <p>
            <strong>Charges:</strong>{' '}
            {status.data?.chargesEnabled === true ? 'Enabled' : 'Disabled'}
          </p>
          <p>
            <strong>Payouts:</strong>{' '}
            {status.data?.payoutsEnabled === true ? 'Enabled' : 'Disabled'}
          </p>
          {status.data?.requiresAction !== false && (
            <button
              className="button button-primary"
              disabled={connect.isPending}
              onClick={() => connect.mutate()}
              type="button"
            >
              {connect.isPending ? 'Opening Stripe...' : 'Connect with Stripe'}
            </button>
          )}
          {connect.error instanceof Error && <Notice>{connect.error.message}</Notice>}
        </div>
      </section>
    </main>
  );
}
