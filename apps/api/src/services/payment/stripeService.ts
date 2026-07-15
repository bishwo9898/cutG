import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';

import { env } from '../../config/env';

type StripeFormValue = string | number | boolean | null | undefined;

type StripePaymentIntent = {
  id: string;
  client_secret: string;
};

type StripeRefund = {
  id: string;
};

type StripeAccount = {
  id: string;
};

type StripeAccountLink = {
  url: string;
};

type StripeCheckoutSession = {
  id: string;
  url: string;
};

export const stripePaymentsConfigured = (): boolean =>
  env.NODE_ENV !== 'test' &&
  env.STRIPE_SECRET_KEY.startsWith('sk_') &&
  !env.STRIPE_SECRET_KEY.includes('...');

const toFormBody = (params: Record<string, StripeFormValue>): URLSearchParams => {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) body.set(key, String(value));
  }
  return body;
};

const stripePost = async <T>(
  path: string,
  params: Record<string, StripeFormValue>,
  idempotencyKey?: string,
): Promise<T> => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (idempotencyKey !== undefined) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers,
    body: toFormBody(params),
  });

  const body = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message ?? 'Stripe request failed.');
  }
  return body;
};

const stripeGet = async <T>(path: string): Promise<T> => {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  const body = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? 'Stripe request failed.');
  return body;
};

export const createPaymentIntent = async (input: {
  amountCents: number;
  currency: string;
  destinationAccountId: string;
  platformFeeCents: number;
  metadata: Record<string, string>;
  idempotencyKey: string;
}): Promise<StripePaymentIntent> => {
  if (!stripePaymentsConfigured()) {
    const id = `pi_test_${randomUUID().replaceAll('-', '')}`;
    return { id, client_secret: `${id}_secret_test` };
  }

  return stripePost<StripePaymentIntent>(
    '/payment_intents',
    {
      amount: input.amountCents,
      currency: input.currency,
      'transfer_data[destination]': input.destinationAccountId,
      application_fee_amount: input.platformFeeCents,
      'metadata[appointmentId]': input.metadata.appointmentId,
      'metadata[clientId]': input.metadata.clientId,
      'metadata[barberId]': input.metadata.barberId,
      automatic_payment_methods: 'true',
    },
    input.idempotencyKey,
  );
};

export const retrievePaymentIntent = async (
  paymentIntentId: string,
): Promise<StripePaymentIntent> =>
  stripePaymentsConfigured()
    ? stripeGet<StripePaymentIntent>(`/payment_intents/${paymentIntentId}`)
    : { id: paymentIntentId, client_secret: `${paymentIntentId}_secret_test` };

export const cancelPaymentIntent = async (paymentIntentId: string): Promise<void> => {
  if (!stripePaymentsConfigured()) return;
  await stripePost(`/payment_intents/${paymentIntentId}/cancel`, {});
};

export const createRefund = async (
  paymentIntentId: string,
  reason?: string,
): Promise<StripeRefund> => {
  if (!stripePaymentsConfigured()) return { id: `re_test_${randomUUID().replaceAll('-', '')}` };
  return stripePost<StripeRefund>('/refunds', {
    payment_intent: paymentIntentId,
    reason: reason === undefined ? undefined : 'requested_by_customer',
    'metadata[reason]': reason,
  });
};

export const createConnectAccount = async (email: string): Promise<StripeAccount> => {
  if (!stripePaymentsConfigured()) {
    return { id: `acct_test_${randomUUID().replaceAll('-', '').slice(0, 12)}` };
  }
  return stripePost<StripeAccount>('/accounts', {
    type: 'express',
    country: 'US',
    email,
    'capabilities[card_payments][requested]': true,
    'capabilities[transfers][requested]': true,
  });
};

export const createAccountLink = async (accountId: string): Promise<StripeAccountLink> => {
  if (!stripePaymentsConfigured()) {
    return { url: `https://connect.stripe.com/setup/e/mock_${accountId}` };
  }

  return stripePost<StripeAccountLink>('/account_links', {
    account: accountId,
    refresh_url: `${env.WEB_APP_URL}/dashboard/payments/onboarding/refresh`,
    return_url: `${env.WEB_APP_URL}/dashboard/payments/onboarding/complete`,
    type: 'account_onboarding',
  });
};

export const createSubscriptionCheckout = async (input: {
  customerId: string;
  priceId: string;
  barberId: string;
}): Promise<StripeCheckoutSession> => {
  if (!stripePaymentsConfigured()) {
    return {
      id: `cs_test_${randomUUID().replaceAll('-', '')}`,
      url: `https://checkout.stripe.com/c/pay/mock_${input.priceId}`,
    };
  }

  return stripePost<StripeCheckoutSession>('/checkout/sessions', {
    mode: 'subscription',
    customer: input.customerId,
    'line_items[0][price]': input.priceId,
    'line_items[0][quantity]': 1,
    success_url: `${env.WEB_APP_URL}/dashboard/subscription/success`,
    cancel_url: `${env.WEB_APP_URL}/dashboard/subscription`,
    'metadata[barberId]': input.barberId,
  });
};

export const createCustomer = async (email: string, barberId: string): Promise<{ id: string }> => {
  if (!stripePaymentsConfigured()) {
    return { id: `cus_test_${barberId.replaceAll('-', '').slice(0, 14)}` };
  }
  return stripePost<{ id: string }>('/customers', {
    email,
    'metadata[barberId]': barberId,
  });
};

export const updateSubscriptionCancellation = async (
  subscriptionId: string,
  cancelAtPeriodEnd: boolean,
): Promise<void> => {
  if (!stripePaymentsConfigured()) return;
  await stripePost(`/subscriptions/${subscriptionId}`, {
    cancel_at_period_end: cancelAtPeriodEnd,
  });
};

export const verifyStripeSignature = (
  rawBody: Buffer,
  signatureHeader: string | undefined,
): boolean => {
  if (signatureHeader === undefined) return false;
  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(',')) {
    const [key, value] = part.split('=');
    if (key !== undefined && value !== undefined) {
      parts[key] = value;
    }
  }
  const timestamp = parts.t;
  const signature = parts.v1;
  if (timestamp === undefined || signature === undefined) return false;

  const expected = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(signature, 'hex');
  return (
    expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
  );
};
