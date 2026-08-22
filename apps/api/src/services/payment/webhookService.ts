/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { query, withTransaction } from '../../db/queries/barber.queries';

type StripeEvent = {
  id: string;
  type: string;
  data?: {
    object?: Record<string, unknown>;
  };
};

type Row = Record<string, unknown>;

const objectData = (event: StripeEvent): Record<string, unknown> => event.data?.object ?? {};

const metadata = (object: Record<string, unknown>): Record<string, unknown> =>
  typeof object.metadata === 'object' && object.metadata !== null
    ? (object.metadata as Record<string, unknown>)
    : {};

const findBarberIdForEvent = async (
  event: StripeEvent,
  object: Record<string, unknown>,
): Promise<string | null> => {
  const objectMetadata = metadata(object);
  if (typeof objectMetadata.barberId === 'string') return objectMetadata.barberId;
  if (typeof object.id === 'string' && event.type.startsWith('payment_intent.')) {
    const rows = await query<Row>(
      'SELECT barber_id FROM payments WHERE stripe_payment_intent_id = $1',
      [object.id],
    );
    return typeof rows[0]?.barber_id === 'string' ? rows[0].barber_id : null;
  }
  if (typeof object.id === 'string' && event.type.startsWith('customer.subscription.')) {
    const rows = await query<Row>(
      'SELECT barber_id FROM subscriptions WHERE stripe_subscription_id = $1',
      [object.id],
    );
    return typeof rows[0]?.barber_id === 'string' ? rows[0].barber_id : null;
  }
  if (typeof object.account === 'string') {
    const rows = await query<Row>('SELECT id FROM barber_profiles WHERE stripe_account_id = $1', [
      object.account,
    ]);
    return typeof rows[0]?.id === 'string' ? rows[0].id : null;
  }
  return null;
};

const eventAlreadyProcessed = async (
  event: StripeEvent,
  barberId: string | null,
  object: Record<string, unknown>,
): Promise<boolean> => {
  const rows = await query<Row>(
    `INSERT INTO subscription_events
      (barber_id,stripe_event_id,event_type,stripe_subscription_id,tier,data)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)
     ON CONFLICT (stripe_event_id) DO NOTHING
     RETURNING id`,
    [
      barberId,
      event.id,
      event.type,
      typeof object.id === 'string' && event.type.includes('subscription') ? object.id : null,
      typeof metadata(object).tier === 'string' ? metadata(object).tier : null,
      JSON.stringify(object),
    ],
  );
  return rows.length === 0;
};

const updatePaymentSucceeded = async (object: Record<string, unknown>) =>
  withTransaction(async (trx) => {
    const intentId = String(object.id);
    const rows = await query<Row>(
      `UPDATE payments
       SET status = 'SUCCEEDED', captured_at = CURRENT_TIMESTAMP
       WHERE stripe_payment_intent_id = $1 AND status <> 'SUCCEEDED'
       RETURNING appointment_id, client_id, barber_id`,
      [intentId],
      trx,
    );
    const payment = rows[0];
    if (payment === undefined) return;
    await trx.query(`UPDATE appointments SET payment_status = 'SUCCEEDED' WHERE id = $1`, [
      payment.appointment_id,
    ]);
    const barberRows = await query<Row>(
      'SELECT user_id FROM barber_profiles WHERE id = $1',
      [payment.barber_id],
      trx,
    );
    await trx.query(
      `INSERT INTO notifications (user_id,type,title,message,related_data)
       VALUES ($1,'PAYMENT_SUCCEEDED','Payment confirmed','Your appointment payment was confirmed.',$2::jsonb)`,
      [
        payment.client_id,
        JSON.stringify({ appointmentId: payment.appointment_id, paymentIntentId: intentId }),
      ],
    );
    if (barberRows[0]?.user_id !== undefined) {
      await trx.query(
        `INSERT INTO notifications (user_id,type,title,message,related_data)
         VALUES ($1,'PAYMENT_SUCCEEDED','Paid booking','A customer payment was confirmed.',$2::jsonb)`,
        [
          barberRows[0].user_id,
          JSON.stringify({ appointmentId: payment.appointment_id, paymentIntentId: intentId }),
        ],
      );
    }
  });

const updatePaymentFailed = async (object: Record<string, unknown>) =>
  withTransaction(async (trx) => {
    const intentId = String(object.id);
    const lastPaymentError =
      typeof object.last_payment_error === 'object' && object.last_payment_error !== null
        ? (object.last_payment_error as Record<string, unknown>)
        : {};
    const rows = await query<Row>(
      `UPDATE payments
       SET status = 'FAILED', failed_at = CURRENT_TIMESTAMP, last_error_message = $2
       WHERE stripe_payment_intent_id = $1
       RETURNING appointment_id, client_id`,
      [intentId, lastPaymentError.message ?? 'Payment failed.'],
      trx,
    );
    const payment = rows[0];
    if (payment === undefined) return;
    await trx.query(`UPDATE appointments SET payment_status = 'FAILED' WHERE id = $1`, [
      payment.appointment_id,
    ]);
    await trx.query(
      `INSERT INTO notifications (user_id,type,title,message,related_data)
       VALUES ($1,'PAYMENT_FAILED','Payment failed','Your card payment failed. Please try again.',$2::jsonb)`,
      [payment.client_id, JSON.stringify({ appointmentId: payment.appointment_id })],
    );
  });

const upsertSubscriptionFromStripe = async (
  object: Record<string, unknown>,
  status: string,
): Promise<void> => {
  const objectMetadata = metadata(object);
  const barberId = objectMetadata.barberId;
  if (typeof barberId !== 'string') return;
  const tier = typeof objectMetadata.tier === 'string' ? objectMetadata.tier : 'BASIC';
  const interval = typeof objectMetadata.interval === 'string' ? objectMetadata.interval : 'month';
  const periodEnd =
    typeof object.current_period_end === 'number'
      ? new Date(object.current_period_end * 1000)
      : null;
  const periodStart =
    typeof object.current_period_start === 'number'
      ? new Date(object.current_period_start * 1000)
      : null;

  await query(
    `INSERT INTO subscriptions
      (barber_id,tier,status,stripe_subscription_id,stripe_customer_id,billing_cycle_start,
       billing_cycle_end,billing_interval,current_period_start,current_period_end,cancel_at_period_end,
       features)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,CURRENT_TIMESTAMP),COALESCE($7,CURRENT_TIMESTAMP),
       $8,$6,$7,$9,$10::jsonb)
     ON CONFLICT (barber_id) DO UPDATE SET
       tier=EXCLUDED.tier,
       status=EXCLUDED.status,
       stripe_subscription_id=EXCLUDED.stripe_subscription_id,
       stripe_customer_id=EXCLUDED.stripe_customer_id,
       billing_interval=EXCLUDED.billing_interval,
       current_period_start=EXCLUDED.current_period_start,
       current_period_end=EXCLUDED.current_period_end,
       cancel_at_period_end=EXCLUDED.cancel_at_period_end,
       updated_at=CURRENT_TIMESTAMP`,
    [
      barberId,
      tier,
      status,
      object.id,
      object.customer,
      periodStart,
      periodEnd,
      interval,
      object.cancel_at_period_end === true,
      JSON.stringify({ tier }),
    ],
  );
  await query(
    `UPDATE barber_profiles
     SET subscription_tier = $1, subscription_valid_until = $2
     WHERE id = $3`,
    [status === 'CANCELLED' ? 'FREE' : tier, periodEnd, barberId],
  );
};

const updateConnectAccount = async (object: Record<string, unknown>): Promise<void> => {
  if (typeof object.id !== 'string') return;
  await query(
    `UPDATE barber_profiles SET
      stripe_onboarding_complete = $2,
      stripe_charges_enabled = $3,
      stripe_payouts_enabled = $4
     WHERE stripe_account_id = $1`,
    [
      object.id,
      object.details_submitted === true,
      object.charges_enabled === true,
      object.payouts_enabled === true,
    ],
  );
};

export const processStripeWebhookEvent = async (event: StripeEvent) => {
  const object = objectData(event);
  const barberId = await findBarberIdForEvent(event, object);
  if (await eventAlreadyProcessed(event, barberId, object)) {
    return { processed: false, duplicate: true };
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      await updatePaymentSucceeded(object);
      break;
    case 'payment_intent.payment_failed':
      await updatePaymentFailed(object);
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await upsertSubscriptionFromStripe(object, 'ACTIVE');
      break;
    case 'customer.subscription.deleted':
      await upsertSubscriptionFromStripe(object, 'CANCELLED');
      break;
    case 'invoice.payment_succeeded':
    case 'invoice.payment_failed':
      break;
    case 'account.updated':
      await updateConnectAccount(object);
      break;
    default:
      break;
  }

  return { processed: true, duplicate: false };
};
