# Subscriptions

Phase 4 adds barber subscription management and reusable tier gates. Subscriptions are Stripe-backed
for paid tiers but remain readable from the cutG API for mobile and web clients.

## Tiers

Tier definitions live in:

```text
apps/api/src/config/subscriptionTiers.ts
```

| Tier      | Max services | Slot generation horizon | Priority search | Analytics | Messaging |
| --------- | ------------ | ----------------------- | --------------- | --------- | --------- |
| `FREE`    | 5            | 14 days                 | No              | No        | No        |
| `BASIC`   | 20           | 60 days                 | Yes             | No        | No        |
| `PREMIUM` | Unlimited    | 365 days                | Yes             | Yes       | Yes       |

Service creation now reads limits from the shared tier matrix.

## Environment

Stripe Price IDs are configured through env:

```env
STRIPE_PRICE_BASIC_MONTHLY=price_...
STRIPE_PRICE_BASIC_ANNUAL=price_...
STRIPE_PRICE_PREMIUM_MONTHLY=price_...
STRIPE_PRICE_PREMIUM_ANNUAL=price_...
STRIPE_SUBSCRIPTION_SUCCESS_URL=cutg://subscription/success
STRIPE_SUBSCRIPTION_CANCEL_URL=cutg://subscription/cancelled
```

The web app can use the returned Checkout URL. The future mobile app can open the same URL in a
browser or WebView and use the returned deep links.

## Endpoints

```http
GET /barbers/me/subscription
POST /barbers/me/subscription/checkout
POST /barbers/me/subscription/cancel
POST /barbers/me/subscription/resume
GET /barbers/me/analytics
```

`GET /barbers/me/analytics` is a small gated placeholder route used to verify the subscription gate.
It requires `BASIC` or higher.

## Checkout

`POST /barbers/me/subscription/checkout` accepts:

```json
{
  "tier": "BASIC",
  "interval": "month"
}
```

The API creates or reuses a Stripe customer and returns:

```json
{
  "checkoutUrl": "https://checkout.stripe.com/c/pay/...",
  "tier": "BASIC",
  "interval": "month",
  "successDeepLink": "cutg://subscription/success",
  "cancelDeepLink": "cutg://subscription/cancelled"
}
```

## Webhook Sync

Subscription lifecycle state is finalized by Stripe webhooks:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Webhook events are logged in `subscription_events` and deduplicated by `stripe_event_id`.

## Web Pages

Barber-facing subscription pages:

- `/dashboard/subscription`
- `/dashboard/subscription/success`

Payment and earnings pages:

- `/dashboard/payments`
- `/dashboard/payments/onboarding/complete`
- `/dashboard/payments/onboarding/refresh`
- `/dashboard/earnings`
