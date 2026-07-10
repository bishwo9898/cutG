/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { env } from '../../config/env';
import {
  publicFeaturesForTier,
  SUBSCRIPTION_TIERS,
  type SubscriptionTierName,
} from '../../config/subscriptionTiers';
import { query, withTransaction } from '../../db/queries/barber.queries';
import { AppError } from '../../middleware/errorHandler';
import {
  createAccountLink,
  createConnectAccount,
  createCustomer,
  createSubscriptionCheckout,
  updateSubscriptionCancellation,
} from '../payment/stripeService';

type Row = Record<string, unknown>;

const dateTimeOrNull = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
};

const getBarberProfile = async (userId: string) => {
  const rows = await query<Row>(
    `SELECT bp.*, u.email
     FROM barber_profiles bp
     JOIN users u ON u.id = bp.user_id
     WHERE bp.user_id = $1`,
    [userId],
  );
  const profile = rows[0];
  if (profile === undefined) {
    throw new AppError(404, 'Barber profile does not exist.', 'BARBER_PROFILE_NOT_FOUND');
  }
  return profile;
};

const priceIdFor = (tier: 'BASIC' | 'PREMIUM', interval: 'month' | 'year'): string => {
  if (tier === 'BASIC' && interval === 'month') return env.STRIPE_PRICE_BASIC_MONTHLY;
  if (tier === 'BASIC' && interval === 'year') return env.STRIPE_PRICE_BASIC_ANNUAL;
  if (tier === 'PREMIUM' && interval === 'month') return env.STRIPE_PRICE_PREMIUM_MONTHLY;
  return env.STRIPE_PRICE_PREMIUM_ANNUAL;
};

export const startStripeConnectOnboarding = async (userId: string) => {
  const profile = await getBarberProfile(userId);
  let stripeAccountId =
    typeof profile.stripe_account_id === 'string' ? profile.stripe_account_id : null;
  if (stripeAccountId === null || stripeAccountId.length === 0) {
    const account = await createConnectAccount(String(profile.email));
    stripeAccountId = account.id;
    await query('UPDATE barber_profiles SET stripe_account_id = $1 WHERE id = $2', [
      stripeAccountId,
      profile.id,
    ]);
  }
  const link = await createAccountLink(stripeAccountId);
  return {
    onboardingUrl: link.url,
    stripeAccountId,
    message: 'Complete Stripe onboarding to receive payments.',
  };
};

export const getStripeConnectStatus = async (userId: string) => {
  const profile = await getBarberProfile(userId);
  const hasAccount = typeof profile.stripe_account_id === 'string';
  return {
    stripeAccountId: hasAccount ? profile.stripe_account_id : null,
    onboardingComplete: profile.stripe_onboarding_complete === true,
    chargesEnabled: profile.stripe_charges_enabled === true,
    payoutsEnabled: profile.stripe_payouts_enabled === true,
    requiresAction:
      !hasAccount ||
      profile.stripe_onboarding_complete !== true ||
      profile.stripe_charges_enabled !== true ||
      profile.stripe_payouts_enabled !== true,
    ...(!hasAccount ? { message: 'Complete Stripe onboarding to accept payments.' } : {}),
  };
};

export const getSubscriptionStatus = async (userId: string) => {
  const profile = await getBarberProfile(userId);
  const rows = await query<Row>(
    `SELECT * FROM subscriptions
     WHERE barber_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [profile.id],
  );
  const subscription = rows[0];
  const tier = String(profile.subscription_tier ?? 'FREE') as SubscriptionTierName;
  if (subscription === undefined) {
    return {
      tier,
      status: 'ACTIVE',
      features: publicFeaturesForTier(tier),
    };
  }
  return {
    tier: subscription.tier,
    status: subscription.status,
    billingInterval: subscription.billing_interval,
    currentPeriodEnd: dateTimeOrNull(
      subscription.current_period_end ?? subscription.billing_cycle_end,
    ),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    features: publicFeaturesForTier(String(subscription.tier) as SubscriptionTierName),
    stripeSubscriptionId: subscription.stripe_subscription_id,
  };
};

export const createSubscriptionCheckoutSession = async (
  userId: string,
  tier: 'BASIC' | 'PREMIUM',
  interval: 'month' | 'year',
) =>
  withTransaction(async (trx) => {
    const profile = await getBarberProfile(userId);
    const existingRows = await query<Row>(
      'SELECT * FROM subscriptions WHERE barber_id = $1 ORDER BY created_at DESC LIMIT 1',
      [profile.id],
      trx,
    );
    let customerId =
      typeof existingRows[0]?.stripe_customer_id === 'string'
        ? existingRows[0].stripe_customer_id
        : null;
    if (customerId === null) {
      const customer = await createCustomer(String(profile.email), String(profile.id));
      customerId = customer.id;
    }
    const checkout = await createSubscriptionCheckout({
      customerId,
      priceId: priceIdFor(tier, interval),
      barberId: String(profile.id),
    });
    await trx.query(
      `INSERT INTO subscriptions
        (barber_id,tier,status,stripe_customer_id,billing_cycle_start,billing_cycle_end,
         billing_interval,current_period_start,current_period_end,features)
       VALUES ($1,$2,'ACTIVE',$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + interval '30 days',
         $4,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + interval '30 days',$5::jsonb)
       ON CONFLICT (barber_id) DO UPDATE SET
         tier=EXCLUDED.tier,
         stripe_customer_id=EXCLUDED.stripe_customer_id,
         billing_interval=EXCLUDED.billing_interval,
         updated_at=CURRENT_TIMESTAMP`,
      [
        profile.id,
        tier,
        customerId,
        interval,
        JSON.stringify({
          ...SUBSCRIPTION_TIERS[tier],
          maxServices: tier === 'PREMIUM' ? -1 : SUBSCRIPTION_TIERS[tier].maxServices,
        }),
      ],
    );
    return {
      checkoutUrl: checkout.url,
      tier,
      interval,
      successDeepLink: env.STRIPE_SUBSCRIPTION_SUCCESS_URL,
      cancelDeepLink: env.STRIPE_SUBSCRIPTION_CANCEL_URL,
    };
  });

const updateCancelAtPeriodEnd = async (userId: string, cancelAtPeriodEnd: boolean) =>
  withTransaction(async (trx) => {
    const profile = await getBarberProfile(userId);
    const rows = await query<Row>(
      `SELECT * FROM subscriptions
       WHERE barber_id = $1 AND stripe_subscription_id IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [profile.id],
      trx,
    );
    const subscription = rows[0];
    if (subscription === undefined) {
      throw new AppError(404, 'Active Stripe subscription not found.', 'SUBSCRIPTION_NOT_FOUND');
    }
    await updateSubscriptionCancellation(
      String(subscription.stripe_subscription_id),
      cancelAtPeriodEnd,
    );
    const updatedRows = await query<Row>(
      `UPDATE subscriptions
       SET cancel_at_period_end = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [cancelAtPeriodEnd, subscription.id],
      trx,
    );
    return updatedRows[0] as Row;
  });

export const cancelSubscription = async (userId: string) => {
  const subscription = await updateCancelAtPeriodEnd(userId, true);
  return {
    message: 'Subscription will cancel at end of current period.',
    cancelAt: dateTimeOrNull(subscription.current_period_end ?? subscription.billing_cycle_end),
  };
};

export const resumeSubscription = async (userId: string) => {
  const subscription = await updateCancelAtPeriodEnd(userId, false);
  return {
    message: 'Subscription renewal resumed.',
    tier: subscription.tier,
  };
};
