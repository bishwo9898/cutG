# Payments

Phase 4 adds Stripe Payment Intent support for appointment payments, Stripe Connect onboarding for
barber payouts, refunds, webhook syncing, client payment history, and barber earnings.

## Environment

Local development works with placeholder Stripe values. When `STRIPE_SECRET_KEY` contains the
placeholder `...`, the API returns deterministic mock Stripe IDs and URLs.

Required production/test-mode values:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PLATFORM_FEE_PERCENT=10
```

## Client Payment Flow

Mobile-compatible payment flow:

1. Client books an appointment.
2. Client calls `POST /payments/create-intent`.
3. API verifies appointment ownership, status, payment state, barber Stripe onboarding, and fee math.
4. API creates a Stripe Payment Intent with `application_fee_amount` and
   `transfer_data[destination]`.
5. Client app passes `clientSecret` to Stripe React Native or web Stripe SDK.
6. Stripe webhook `payment_intent.succeeded` marks the payment and appointment as paid.

The API does not trust client-side payment confirmation. Webhooks are the source of truth.

## Fee Structure

Money is stored in integer cents:

- `payments.amount_cents`: total charged to the client.
- `payments.platform_fee_cents`: cutG fee, controlled by `PLATFORM_FEE_PERCENT`.
- `payments.barber_payout_cents`: barber earnings after fee.

API responses convert cents to JSON numbers for display.

## Endpoints

```http
POST /payments/create-intent
GET /payments/appointment/:appointmentId
POST /payments/refund
GET /clients/me/payment-history
POST /barbers/me/stripe/connect
GET /barbers/me/stripe/status
GET /barbers/me/earnings
POST /webhooks/stripe
```

## Refunds

Clients can refund paid appointments that have not been completed:

```http
POST /payments/refund
```

Refunds call Stripe, mark `payments.status = REFUNDED`, mark the appointment `CANCELLED`, update
`appointments.payment_status = REFUNDED`, and free the linked availability slot.

## Webhooks

`POST /webhooks/stripe` is mounted before `express.json()` so Stripe signature verification can use
the raw request body. Missing or invalid signatures return `400 INVALID_SIGNATURE`.

Handled events:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `account.updated`

Webhook idempotency uses `subscription_events.stripe_event_id`.

## Stripe CLI

For local webhook testing with real Stripe test keys:

```bash
stripe login
stripe listen --forward-to localhost:4000/webhooks/stripe
```

Copy the printed `whsec_...` value into `STRIPE_WEBHOOK_SECRET`, then trigger events:

```bash
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger customer.subscription.updated
```
