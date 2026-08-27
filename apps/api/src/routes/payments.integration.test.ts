import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { app } from '../app';
import { closeDatabase, pool } from '../config/database';
import {
  createBarberProfileFixture,
  createVerifiedUser,
  resetTestDatabase,
} from '../test/fixtures';

let barberToken = '';
let clientToken = '';
let barberId = '';
let serviceId = '';
let appointmentId = '';

type IntentBody = { clientSecret: string; breakdown: { platformFee: number } };
type StripeStatusBody = { onboardingComplete: boolean };
type EarningsBody = { summary: Record<string, unknown> };
type SubscriptionBody = { tier: string };
type ErrorBody = { error: string };
type PaymentConfigBody = { onlinePaymentsEnabled: boolean; publishableKey: string | null };

beforeAll(async () => {
  await resetTestDatabase();
  const barber = await createVerifiedUser('BARBER', 'phase4.barber@example.com');
  const client = await createVerifiedUser('CLIENT', 'phase4.client@example.com');
  barberId = await createBarberProfileFixture(barber.id);
  await pool.query(
    `UPDATE barber_profiles SET
      stripe_account_id = 'acct_test_phase4',
      stripe_onboarding_complete = true,
      stripe_charges_enabled = true,
      stripe_payouts_enabled = true,
      subscription_tier = 'PREMIUM'
     WHERE id = $1`,
    [barberId],
  );

  const service = await pool.query<{ id: string }>(
    `INSERT INTO services (barber_id,name,price,duration_minutes,category)
     VALUES ($1,'Paid Fade',25,30,'haircut')
     RETURNING id`,
    [barberId],
  );
  serviceId = service.rows[0]?.id ?? '';
  const slot = await pool.query<{ id: string }>(
    `INSERT INTO availability_slots (barber_id,slot_date,start_time,end_time,duration_minutes,status)
     VALUES ($1,'2026-08-10','10:00','10:30',30,'BOOKED')
     RETURNING id`,
    [barberId],
  );
  const appointment = await pool.query<{ id: string }>(
    `INSERT INTO appointments
      (client_id,barber_id,service_id,availability_slot_id,scheduled_at,duration_minutes,status,
       payment_status,payment_method,location_address,price_quoted)
     VALUES ($1,$2,$3,$4,'2026-08-10 10:00:00',30,'PENDING','PENDING','CARD','1 Test Street',25)
     RETURNING id`,
    [client.id, barberId, serviceId, slot.rows[0]?.id],
  );
  appointmentId = appointment.rows[0]?.id ?? '';
  await pool.query('UPDATE availability_slots SET appointment_id = $1 WHERE id = $2', [
    appointmentId,
    slot.rows[0]?.id,
  ]);

  barberToken = barber.clerkUserId;
  clientToken = client.clerkUserId;
});

afterAll(async () => closeDatabase());

describe('Phase 4 payments and subscriptions API', () => {
  it('returns a safe client payment configuration', async () => {
    const response = await request(app)
      .get('/payments/config')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(response.status).toBe(200);
    expect(response.body as PaymentConfigBody).toEqual({
      onlinePaymentsEnabled: false,
      publishableKey: null,
    });
  });

  it('creates a mobile-compatible payment intent for a client appointment', async () => {
    const response = await request(app)
      .post('/payments/create-intent')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ appointmentId });

    expect(response.status).toBe(200);
    expect((response.body as IntentBody).clientSecret).toContain('_secret_');
    expect((response.body as IntentBody).breakdown.platformFee).toBe(2.5);

    const retry = await request(app)
      .post('/payments/create-intent')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ appointmentId });
    expect(retry.status).toBe(200);
    expect((retry.body as IntentBody).clientSecret).toBe(
      (response.body as IntentBody).clientSecret,
    );
  });

  it('defaults online payments on and enforces the barber preference at checkout', async () => {
    const initial = await request(app)
      .get('/barbers/me/payment-preferences')
      .set('Authorization', `Bearer ${barberToken}`);
    expect(initial.status).toBe(200);
    expect(initial.body).toMatchObject({ onlinePaymentsEnabled: true });

    const disabled = await request(app)
      .patch('/barbers/me/payment-preferences')
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ onlinePaymentsEnabled: false });
    expect(disabled.status).toBe(200);
    expect(disabled.body).toMatchObject({ onlinePaymentsEnabled: false, onlinePaymentsReady: false });

    const rejected = await request(app)
      .post('/payments/create-intent')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ appointmentId });
    expect(rejected.status).toBe(402);
    expect(rejected.body).toMatchObject({ error: 'BARBER_NOT_ONBOARDED' });

    await request(app)
      .patch('/barbers/me/payment-preferences')
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ onlinePaymentsEnabled: true })
      .expect(200);
  });

  it('returns barber stripe status, earnings, and subscription state', async () => {
    const stripeStatus = await request(app)
      .get('/barbers/me/stripe/status')
      .set('Authorization', `Bearer ${barberToken}`);
    expect(stripeStatus.status).toBe(200);
    expect((stripeStatus.body as StripeStatusBody).onboardingComplete).toBe(true);

    const earnings = await request(app)
      .get('/barbers/me/earnings')
      .set('Authorization', `Bearer ${barberToken}`);
    expect(earnings.status).toBe(200);
    expect((earnings.body as EarningsBody).summary).toHaveProperty('totalEarnings');

    const subscription = await request(app)
      .get('/barbers/me/subscription')
      .set('Authorization', `Bearer ${barberToken}`);
    expect(subscription.status).toBe(200);
    expect((subscription.body as SubscriptionBody).tier).toBe('PREMIUM');
  });

  it('rejects unsigned Stripe webhook payloads', async () => {
    const response = await request(app).post('/webhooks/stripe').send({ type: 'test' });
    expect(response.status).toBe(400);
    expect((response.body as ErrorBody).error).toBe('INVALID_SIGNATURE');
  });

  it('cancels a pending card intent with its appointment', async () => {
    const response = await request(app)
      .delete(`/clients/me/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(response.status).toBe(200);

    const payment = await pool.query<{ status: string }>(
      'SELECT status FROM payments WHERE appointment_id=$1',
      [appointmentId],
    );
    expect(payment.rows[0]?.status).toBe('FAILED');
  });
});
