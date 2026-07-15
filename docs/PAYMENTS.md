# Payments

Phase 4 adds Stripe Payment Intent support for appointment payments, Stripe Connect onboarding for
barber payouts, refunds, webhook syncing, client payment history, and barber earnings.

## Environment

Automated tests use deterministic mock Stripe IDs. Browser card collection requires real Stripe
test-mode values and a barber that has completed Connect onboarding.

Required production/test-mode values:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PLATFORM_FEE_PERCENT=10
```

`STRIPE_PUBLISHABLE_KEY` is the canonical web variable. The API also accepts the older
`STRIPE_PUBLIC_KEY` alias so existing local environments continue to work.

## Client Payment Flow

Web and mobile-compatible card flow:

1. Client chooses `CASH` or `CARD` while booking.
2. Cash creates no Payment Intent and is paid at the appointment.
3. Card reserves the appointment, then calls `POST /payments/create-intent`.
4. API verifies appointment ownership, `paymentMethod = CARD`, status, payment state, barber Stripe onboarding, and fee math.
5. API creates a Stripe Payment Intent with `application_fee_amount` and
   `transfer_data[destination]`.
6. The web client renders Stripe Payment Element and confirms the full service-plus-travel total.
7. Stripe webhook `payment_intent.succeeded` marks the payment and appointment as paid.

The API does not trust client-side payment confirmation. Webhooks are the source of truth.
Intent creation uses `appointment:<appointmentId>` as the Stripe idempotency key. Repeated requests
retrieve the real existing client secret instead of creating a second payment.

## Fee Structure

Money is stored in integer cents:

- `payments.amount_cents`: total charged to the client.
- `payments.platform_fee_cents`: cutG fee, controlled by `PLATFORM_FEE_PERCENT`.
- `payments.barber_payout_cents`: barber earnings after fee.

API responses convert cents to JSON numbers for display.

## Endpoints

```http
GET /payments/config
POST /payments/create-intent
GET /payments/appointment/:appointmentId
POST /payments/refund
GET /clients/me/payment-history
POST /barbers/me/stripe/connect
GET /barbers/me/stripe/status
GET /barbers/me/earnings
POST /webhooks/stripe
```

`GET /payments/config` is client-authenticated and returns only the publishable key plus an
`onlinePaymentsEnabled` flag. Secret Stripe credentials never reach the browser.

## Refunds

Clients can refund paid appointments that have not been completed:

```http
POST /payments/refund
```

Refunds call Stripe, mark `payments.status = REFUNDED`, mark the appointment `CANCELLED`, update
`appointments.payment_status = REFUNDED`, and free the linked availability slot.

Cancelling an unpaid card appointment cancels its pending Payment Intent and marks the local
payment attempt failed before releasing the appointment slot. Cash cancellations have no Stripe
side effect.

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

Stripe variables alone do not make a barber card-ready. Complete Connect onboarding from the
barber payment dashboard and allow the resulting `account.updated` webhook to set charges and
payouts enabled. Use Stripe test card `4242 4242 4242 4242` with any future expiry and CVC.

Copy the printed `whsec_...` value into `STRIPE_WEBHOOK_SECRET`, then trigger events:

```bash
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger customer.subscription.updated
```
