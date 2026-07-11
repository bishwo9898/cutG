/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { env } from '../../config/env';
import { query, withTransaction } from '../../db/queries/barber.queries';
import { AppError } from '../../middleware/errorHandler';
import type { AuthenticatedUser } from '../../types/auth';
import { releaseTravelBufferSlots } from '../mobile/bufferSlotService';

import { createPaymentIntent, createRefund } from './stripeService';

type Row = Record<string, unknown>;

const dollars = (cents: unknown): number => Number(cents ?? 0) / 100;
const centsFromMoney = (value: unknown): number => Math.round(Number(value) * 100);
const dateTimeOrNull = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
};
const pagination = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

const paymentBreakdown = (row: Row) => ({
  total: dollars(row.amount_cents),
  platformFee: dollars(row.platform_fee_cents),
  barberEarns: dollars(row.barber_payout_cents),
});

export const createAppointmentPaymentIntent = async (clientId: string, appointmentId: string) =>
  withTransaction(async (trx) => {
    const appointmentRows = await query<Row>(
      `SELECT
         a.*,
         bp.stripe_account_id,
         bp.stripe_onboarding_complete,
         bp.user_id AS barber_user_id
       FROM appointments a
       JOIN barber_profiles bp ON bp.id = a.barber_id
       WHERE a.id = $1 AND a.client_id = $2
       FOR UPDATE`,
      [appointmentId, clientId],
      trx,
    );
    const appointment = appointmentRows[0];
    if (appointment === undefined) {
      throw new AppError(404, 'Appointment not found.', 'APPOINTMENT_NOT_FOUND');
    }
    if (!['PENDING', 'CONFIRMED'].includes(String(appointment.status))) {
      throw new AppError(400, 'This appointment cannot be paid.', 'CANNOT_PAY_APPOINTMENT');
    }
    if (appointment.payment_status !== 'PENDING') {
      throw new AppError(409, 'This appointment has already been paid.', 'ALREADY_PAID');
    }
    if (
      appointment.stripe_onboarding_complete !== true ||
      typeof appointment.stripe_account_id !== 'string'
    ) {
      throw new AppError(
        402,
        'This barber has not completed payment setup. Please contact them directly.',
        'BARBER_NOT_ONBOARDED',
      );
    }

    const existingRows = await query<Row>(
      `SELECT * FROM payments
       WHERE appointment_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [appointmentId],
      trx,
    );
    const existing = existingRows[0];
    if (existing?.status === 'SUCCEEDED') {
      throw new AppError(409, 'This appointment has already been paid.', 'ALREADY_PAID');
    }
    if (
      existing !== undefined &&
      existing.status === 'PENDING' &&
      typeof existing.stripe_payment_intent_id === 'string'
    ) {
      return {
        clientSecret: `${existing.stripe_payment_intent_id}_secret_existing`,
        paymentIntentId: existing.stripe_payment_intent_id,
        amount: dollars(existing.amount_cents),
        currency: existing.currency,
        breakdown: paymentBreakdown(existing),
      };
    }

    const totalCents =
      centsFromMoney(appointment.price_quoted) + Number(appointment.travel_fee_cents ?? 0);
    const platformFeeCents = Math.round((totalCents * env.PLATFORM_FEE_PERCENT) / 100);
    const barberPayoutCents = totalCents - platformFeeCents;
    const intent = await createPaymentIntent({
      amountCents: totalCents,
      currency: 'usd',
      destinationAccountId: appointment.stripe_account_id,
      platformFeeCents,
      metadata: {
        appointmentId,
        clientId,
        barberId: String(appointment.barber_id),
      },
    });

    const paymentRows = await query<Row>(
      `INSERT INTO payments
        (appointment_id,client_id,barber_id,amount_cents,currency,stripe_payment_intent_id,
         status,platform_fee_cents,barber_payout_cents,metadata)
       VALUES ($1,$2,$3,$4,'usd',$5,'PENDING',$6,$7,$8::jsonb)
       RETURNING *`,
      [
        appointmentId,
        clientId,
        appointment.barber_id,
        totalCents,
        intent.id,
        platformFeeCents,
        barberPayoutCents,
        JSON.stringify({ source: 'payment_intent' }),
      ],
      trx,
    );
    const payment = paymentRows[0] as Row;

    return {
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount: dollars(payment.amount_cents),
      currency: payment.currency,
      breakdown: paymentBreakdown(payment),
    };
  });

export const getAppointmentPaymentStatus = async (
  user: AuthenticatedUser,
  appointmentId: string,
) => {
  const values: unknown[] = [appointmentId];
  let ownership = 'a.client_id = $2';
  values.push(user.id);
  if (user.userType === 'BARBER') {
    ownership = 'bp.user_id = $2';
  }

  const rows = await query<Row>(
    `SELECT p.*, a.id AS appointment_id
     FROM appointments a
     JOIN barber_profiles bp ON bp.id = a.barber_id
     LEFT JOIN payments p ON p.appointment_id = a.id
     WHERE a.id = $1 AND ${ownership}
     ORDER BY p.created_at DESC
     LIMIT 1`,
    values,
  );
  const row = rows[0];
  if (row === undefined) throw new AppError(404, 'Payment not found.', 'PAYMENT_NOT_FOUND');
  if (row.id === null || row.id === undefined) {
    return {
      appointmentId,
      status: 'PENDING',
      amount: 0,
      paidAt: null,
      breakdown: { total: 0, platformFee: 0, barberEarns: 0 },
    };
  }
  return {
    appointmentId,
    status: row.status,
    amount: dollars(row.amount_cents),
    paidAt: dateTimeOrNull(row.captured_at),
    breakdown: paymentBreakdown(row),
  };
};

export const refundAppointmentPayment = async (
  clientId: string,
  appointmentId: string,
  reason?: string,
) =>
  withTransaction(async (trx) => {
    const rows = await query<Row>(
      `SELECT a.*, p.id AS payment_id, p.amount_cents, p.stripe_payment_intent_id, p.status AS payment_status_value
       FROM appointments a
       JOIN payments p ON p.appointment_id = a.id
       WHERE a.id = $1 AND a.client_id = $2
       ORDER BY p.created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [appointmentId, clientId],
      trx,
    );
    const row = rows[0];
    if (row === undefined) throw new AppError(404, 'Payment not found.', 'PAYMENT_NOT_FOUND');
    if (row.status === 'COMPLETED') {
      throw new AppError(400, 'Cannot refund a completed appointment.', 'CANNOT_REFUND');
    }
    if (row.payment_status_value !== 'SUCCEEDED') {
      throw new AppError(400, 'Only succeeded payments can be refunded.', 'CANNOT_REFUND');
    }

    const refund = await createRefund(String(row.stripe_payment_intent_id), reason);
    await trx.query(
      `UPDATE payments
       SET status = 'REFUNDED', stripe_refund_id = $1, refunded_at = CURRENT_TIMESTAMP, refund_reason = $2
       WHERE id = $3`,
      [refund.id, reason ?? null, row.payment_id],
    );
    await trx.query(
      `UPDATE appointments
       SET status = 'CANCELLED', payment_status = 'REFUNDED', cancelled_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [appointmentId],
    );
    if (row.availability_slot_id !== null) {
      await trx.query(
        `UPDATE availability_slots SET status = 'AVAILABLE', appointment_id = NULL WHERE id = $1`,
        [row.availability_slot_id],
      );
    }
    await releaseTravelBufferSlots(appointmentId, trx);

    return {
      message: 'Refund issued successfully.',
      refundAmount: dollars(row.amount_cents),
      appointmentId,
    };
  });

export const listClientPaymentHistory = async (clientId: string, page: number, limit: number) => {
  const totalRows = await query<Row>(
    'SELECT COUNT(*)::int AS total FROM payments WHERE client_id = $1',
    [clientId],
  );
  const rows = await query<Row>(
    `SELECT p.*, a.scheduled_at, s.name AS service_name, bp.business_name
     FROM payments p
     JOIN appointments a ON a.id = p.appointment_id
     JOIN services s ON s.id = a.service_id
     JOIN barber_profiles bp ON bp.id = p.barber_id
     WHERE p.client_id = $1
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [clientId, limit, (page - 1) * limit],
  );
  const total = Number(totalRows[0]?.total ?? 0);
  return {
    payments: rows.map((row) => ({
      id: row.id,
      amount: dollars(row.amount_cents),
      status: row.status,
      paidAt: dateTimeOrNull(row.captured_at),
      appointment: {
        id: row.appointment_id,
        scheduledAt: dateTimeOrNull(row.scheduled_at),
        service: { name: row.service_name },
        barber: { businessName: row.business_name },
      },
    })),
    pagination: pagination(page, limit, total),
  };
};

export const getBarberEarnings = async (barberUserId: string, period: 'week' | 'month' | 'all') => {
  const profileRows = await query<Row>('SELECT id FROM barber_profiles WHERE user_id = $1', [
    barberUserId,
  ]);
  const profile = profileRows[0];
  if (profile === undefined) {
    throw new AppError(404, 'Barber profile does not exist.', 'BARBER_PROFILE_NOT_FOUND');
  }
  const where = ['p.barber_id = $1', "p.status IN ('SUCCEEDED','REFUNDED')"];
  if (period === 'week') where.push("p.created_at >= CURRENT_TIMESTAMP - interval '7 days'");
  if (period === 'month') where.push("p.created_at >= CURRENT_TIMESTAMP - interval '30 days'");
  const whereSql = where.join(' AND ');
  const summaryRows = await query<Row>(
    `SELECT
       COALESCE(SUM(CASE WHEN p.status='SUCCEEDED' THEN p.barber_payout_cents ELSE 0 END),0)::int AS total_earnings,
       COALESCE(SUM(CASE WHEN p.status='SUCCEEDED' THEN p.platform_fee_cents ELSE 0 END),0)::int AS platform_fees,
       COUNT(*) FILTER (WHERE p.status='SUCCEEDED')::int AS appointments_completed,
       COALESCE(SUM(CASE WHEN p.status='SUCCEEDED' AND p.payout_batch_id IS NULL THEN p.barber_payout_cents ELSE 0 END),0)::int AS pending_payout,
       COALESCE(SUM(CASE WHEN pb.status='paid' THEN p.barber_payout_cents ELSE 0 END),0)::int AS paid_out
     FROM payments p
     LEFT JOIN payout_batches pb ON pb.id = p.payout_batch_id
     WHERE ${whereSql}`,
    [profile.id],
  );
  const recentRows = await query<Row>(
    `SELECT p.*, a.scheduled_at, s.name AS service_name, u.first_name, u.last_name
     FROM payments p
     JOIN appointments a ON a.id = p.appointment_id
     JOIN services s ON s.id = a.service_id
     JOIN users u ON u.id = p.client_id
     WHERE ${whereSql}
     ORDER BY p.created_at DESC
     LIMIT 10`,
    [profile.id],
  );
  const payoutRows = await query<Row>(
    `SELECT * FROM payout_batches WHERE barber_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [profile.id],
  );
  const summary = summaryRows[0] ?? {};

  return {
    period,
    summary: {
      totalEarnings: dollars(summary.total_earnings),
      platformFees: dollars(summary.platform_fees),
      appointmentsCompleted: Number(summary.appointments_completed ?? 0),
      pendingPayout: dollars(summary.pending_payout),
      paidOut: dollars(summary.paid_out),
    },
    recentPayments: recentRows.map((row) => ({
      id: row.id,
      amount: dollars(row.barber_payout_cents),
      grossAmount: dollars(row.amount_cents),
      platformFee: dollars(row.platform_fee_cents),
      status: row.status,
      capturedAt: dateTimeOrNull(row.captured_at),
      appointment: {
        scheduledAt: dateTimeOrNull(row.scheduled_at),
        service: { name: row.service_name },
        client: {
          firstName: row.first_name,
          lastInitial: String(row.last_name ?? '').slice(0, 1),
        },
      },
    })),
    payoutHistory: payoutRows.map((row) => ({
      id: row.id,
      amount: dollars(row.amount_cents),
      status: row.status,
      appointmentCount: row.appointment_count,
      paidAt: dateTimeOrNull(row.paid_at),
    })),
  };
};
