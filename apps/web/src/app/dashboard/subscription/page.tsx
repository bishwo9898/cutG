'use client';

import { barberBillingApi } from '@barber-saas/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useState } from 'react';

import { Notice } from '@/components/notice';
import { browserApi } from '@/lib/browser-api';

type Subscription = {
  tier: 'FREE' | 'BASIC' | 'PREMIUM';
  status: string;
  billingInterval?: 'month' | 'year';
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  features: Record<string, boolean | number>;
};
type Checkout = { checkoutUrl: string };

const plans = [
  { tier: 'FREE', label: 'Free', price: '$0', features: ['5 services', '14-day slots'] },
  { tier: 'BASIC', label: 'Basic', price: '$29', features: ['20 services', 'Priority search'] },
  {
    tier: 'PREMIUM',
    label: 'Premium',
    price: '$79',
    features: ['Unlimited services', 'Analytics'],
  },
] as const;

export default function SubscriptionPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const subscription = useQuery({
    queryKey: ['subscription'],
    queryFn: () => barberBillingApi.subscription<Subscription>(browserApi),
  });
  const checkout = useMutation({
    mutationFn: (tier: 'BASIC' | 'PREMIUM') =>
      barberBillingApi.checkout<Checkout>(browserApi, { tier, interval }),
    onSuccess: (response) => {
      window.location.href = response.checkoutUrl;
    },
  });
  const cancel = useMutation({
    mutationFn: () => barberBillingApi.cancelSubscription(browserApi),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['subscription'] }),
  });
  const resume = useMutation({
    mutationFn: () => barberBillingApi.resumeSubscription(browserApi),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['subscription'] }),
  });

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Subscription</span>
          <h1>Plan and billing</h1>
          <p>Manage the tier that unlocks cutG business features.</p>
        </div>
        <select
          className="select"
          value={interval}
          onChange={(event) => setInterval(event.target.value as typeof interval)}
        >
          <option value="month">Monthly</option>
          <option value="year">Annual</option>
        </select>
      </div>
      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <h2>Current tier: {subscription.data?.tier ?? 'Loading'}</h2>
          <span className="badge badge-success">{subscription.data?.status ?? 'ACTIVE'}</span>
        </div>
        <div className="panel-body form-stack">
          <p className="subtitle">
            {subscription.data?.cancelAtPeriodEnd === true
              ? 'This subscription is set to cancel at period end.'
              : 'Your subscription renews normally.'}
          </p>
          {subscription.data?.tier !== 'FREE' &&
            (subscription.data?.cancelAtPeriodEnd === true ? (
              <button
                className="button button-secondary"
                onClick={() => resume.mutate()}
                type="button"
              >
                Resume renewal
              </button>
            ) : (
              <button
                className="button button-danger"
                onClick={() => cancel.mutate()}
                type="button"
              >
                Cancel at period end
              </button>
            ))}
          {(cancel.error instanceof Error || resume.error instanceof Error) && (
            <Notice>{cancel.error?.message ?? resume.error?.message}</Notice>
          )}
        </div>
      </section>
      <div className="barber-grid">
        {plans.map((plan) => (
          <section className="panel" key={plan.tier}>
            <div className="panel-header">
              <h2>{plan.label}</h2>
              <strong>{plan.price}</strong>
            </div>
            <div className="panel-body form-stack">
              {plan.features.map((feature) => (
                <p className="muted" key={feature}>
                  <Check size={16} /> {feature}
                </p>
              ))}
              {plan.tier !== 'FREE' && (
                <button
                  className="button button-primary"
                  disabled={checkout.isPending}
                  onClick={() => checkout.mutate(plan.tier)}
                  type="button"
                >
                  Choose {plan.label}
                </button>
              )}
            </div>
          </section>
        ))}
      </div>
      {checkout.error instanceof Error && <Notice>{checkout.error.message}</Notice>}
    </main>
  );
}
