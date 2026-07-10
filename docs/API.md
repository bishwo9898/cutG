# API

The API exposes foundation infrastructure, auth, barber-management, client marketplace, payments,
and barber subscription routes.

## Current Routes

```http
GET /health
POST /auth/register
POST /auth/verify-email
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET /auth/me
PATCH /auth/me
POST /auth/forgot-password
POST /auth/reset-password
GET /barbers
GET /barbers/:barberId/reviews
GET /clients/me
GET /clients/me/saved-barbers
POST /clients/me/saved-barbers
DELETE /clients/me/saved-barbers/:barberId
POST /clients/me/appointments
GET /clients/me/appointments
GET /clients/me/appointments/:appointmentId
DELETE /clients/me/appointments/:appointmentId
POST /clients/me/reviews
GET /clients/me/payment-history
POST /payments/create-intent
GET /payments/appointment/:appointmentId
POST /payments/refund
POST /webhooks/stripe
POST /barbers/me/stripe/connect
GET /barbers/me/stripe/status
GET /barbers/me/earnings
GET /barbers/me/subscription
POST /barbers/me/subscription/checkout
POST /barbers/me/subscription/cancel
POST /barbers/me/subscription/resume
```

## Phase 2 Barber Routes

All `/barbers/me/*` routes require a bearer token for a `BARBER` account. Public routes use the
`barber_profiles.id` UUID. Invalid Zod input returns HTTP `422`.

| Method   | Path                                             | Purpose                              |
| -------- | ------------------------------------------------ | ------------------------------------ |
| `GET`    | `/barbers/me`                                    | Read the current barber profile.     |
| `POST`   | `/barbers/me/profile`                            | Create a profile once.               |
| `PATCH`  | `/barbers/me/profile`                            | Update profile fields.               |
| `POST`   | `/barbers/me/photo`                              | Store a validated photo URL.         |
| `POST`   | `/barbers/me/services`                           | Create a tier-limited service.       |
| `GET`    | `/barbers/me/services`                           | List/filter owned services.          |
| `GET`    | `/barbers/me/services/:serviceId`                | Read an owned service.               |
| `PATCH`  | `/barbers/me/services/:serviceId`                | Update an owned service.             |
| `DELETE` | `/barbers/me/services/:serviceId`                | Soft-delete an owned service.        |
| `GET`    | `/barbers/me/schedule`                           | Read the weekly schedule.            |
| `PUT`    | `/barbers/me/schedule`                           | Replace the weekly schedule.         |
| `GET`    | `/barbers/me/slots`                              | List a date range of slots.          |
| `POST`   | `/barbers/me/slots/generate`                     | Idempotently generate slots.         |
| `POST`   | `/barbers/me/blocked-dates`                      | Block a local calendar date.         |
| `DELETE` | `/barbers/me/blocked-dates/:date`                | Unblock and regenerate a date.       |
| `GET`    | `/barbers/me/appointments`                       | List paginated appointments.         |
| `PATCH`  | `/barbers/me/appointments/:appointmentId/status` | Apply an allowed status transition.  |
| `POST`   | `/barbers/me/stripe/connect`                     | Start Stripe Connect onboarding.     |
| `GET`    | `/barbers/me/stripe/status`                      | Read Connect onboarding status.      |
| `GET`    | `/barbers/me/earnings`                           | Read earnings and payout summaries.  |
| `GET`    | `/barbers/me/subscription`                       | Read current subscription status.    |
| `POST`   | `/barbers/me/subscription/checkout`              | Create Stripe subscription checkout. |
| `POST`   | `/barbers/me/subscription/cancel`                | Cancel renewal at period end.        |
| `POST`   | `/barbers/me/subscription/resume`                | Resume renewal.                      |
| `GET`    | `/barbers`                                       | Search public barber marketplace.    |
| `GET`    | `/barbers/:barberId`                             | Read a sanitized public profile.     |
| `GET`    | `/barbers/:barberId/services`                    | List active public services.         |
| `GET`    | `/barbers/:barberId/slots`                       | List safe public availability.       |
| `GET`    | `/barbers/:barberId/reviews`                     | List public barber reviews.          |

Dates use `YYYY-MM-DD`; times use local `HH:MM`. Private slot ranges accept `startDate` and
`endDate`, inclusively, with at most a 30-day difference. Appointment lists support `status`,
`date`, `startDate`, `endDate`, `page`, and `limit` (maximum 50). Public responses exclude precise
location, Stripe fields, metadata, and client information.

## Phase 3 Client Routes

All `/clients/me/*` routes require a bearer token for a `CLIENT` account. Barbers and admins receive
`403` from these routes.

| Method   | Path                                      | Purpose                                      |
| -------- | ----------------------------------------- | -------------------------------------------- |
| `GET`    | `/clients/me`                             | Read the authenticated client profile.       |
| `GET`    | `/clients/me/saved-barbers`               | List saved/favorite barbers.                 |
| `POST`   | `/clients/me/saved-barbers`               | Save a barber by `barber_profiles.id`.       |
| `DELETE` | `/clients/me/saved-barbers/:barberId`     | Remove a saved barber.                       |
| `POST`   | `/clients/me/appointments`                | Book an available slot atomically.           |
| `GET`    | `/clients/me/appointments`                | List paginated client appointments.          |
| `GET`    | `/clients/me/appointments/:appointmentId` | Read one client-owned appointment.           |
| `DELETE` | `/clients/me/appointments/:appointmentId` | Cancel a pending/confirmed appointment.      |
| `POST`   | `/clients/me/reviews`                     | Review a completed client-owned appointment. |
| `GET`    | `/clients/me/payment-history`             | List client payment history.                 |

### Public Barber Search

`GET /barbers` supports:

- `q`: `business_name` and `bio` search.
- `city`, `state`: case-insensitive exact filters.
- `category`: `haircut`, `beard`, `shave`, `combo`, `kids`, or `other`.
- `minRating`: number from `0` to `5`.
- `maxPrice`: barbers with at least one active service at or below the price.
- `verified`: boolean.
- `page`, `limit`: default `1` and `12`; max limit `48`.

The response includes each barber's public profile summary, `lowestServicePrice`,
`serviceCategories`, `nextAvailableSlot`, and pagination.

### Booking Rules

`POST /clients/me/appointments` accepts:

```json
{
  "barberId": "barber_profiles.id",
  "serviceId": "services.id",
  "availabilitySlotId": "availability_slots.id",
  "clientNotes": "Optional note"
}
```

Booking runs in a single database transaction. The API locks the selected slot, verifies the barber
and service, rejects past/booked/short slots, checks client appointment overlap, inserts the
appointment, marks the slot `BOOKED`, and queues notifications. Payments are not collected in Phase
3; new appointments use `paymentStatus = PENDING` and are paid at the shop.

Common booking errors:

| Code                   | Status | Meaning                                         |
| ---------------------- | ------ | ----------------------------------------------- |
| `SLOT_NOT_AVAILABLE`   | `400`  | Slot is booked, blocked, missing, or past.      |
| `SLOT_TOO_SHORT`       | `400`  | Slot duration cannot fit the selected service.  |
| `APPOINTMENT_CONFLICT` | `409`  | Client already has a pending/confirmed overlap. |

Cancelling a `PENDING` or `CONFIRMED` appointment sets status to `CANCELLED`, stamps
`cancelled_at`, and frees the availability slot.

### Reviews

Clients can create one review per completed appointment. Review creation and barber rating
recalculation happen in the same transaction. Public review responses show only the client's first
name and last initial.

## Phase 4 Payments and Subscriptions

Client appointment payments use Stripe Payment Intents, not Checkout Sessions, so mobile apps can
collect card details through Stripe's native SDK.

| Method | Path                                   | Auth             | Purpose                                                   |
| ------ | -------------------------------------- | ---------------- | --------------------------------------------------------- |
| `POST` | `/payments/create-intent`              | Client token     | Create a Payment Intent for an appointment.               |
| `GET`  | `/payments/appointment/:appointmentId` | Client or barber | Read payment status for an owned appointment.             |
| `POST` | `/payments/refund`                     | Client token     | Refund a paid, not-completed appointment.                 |
| `POST` | `/webhooks/stripe`                     | Stripe signature | Process Stripe payment, subscription, and Connect events. |

Payment amounts are stored in cents. Responses expose display numbers:

```json
{
  "amount": 25,
  "breakdown": {
    "total": 25,
    "platformFee": 2.5,
    "barberEarns": 22.5
  }
}
```

Stripe Connect onboarding and barber subscription management live under `/barbers/me/*`.
Subscription checkout returns both a web checkout URL and mobile deep links. Webhook state changes
are idempotent and deduplicated by `subscription_events.stripe_event_id`.

## Auth

`POST /auth/register` creates a `CLIENT`, `BARBER`, or `ADMIN` account and logs a placeholder
email verification code while real email delivery is out of scope.

`POST /auth/login` returns an access token, refresh token, `expiresIn`, and user summary.

Authenticated routes require:

```http
Authorization: Bearer <accessToken>
```

`POST /auth/logout` blacklists the current access token JTI until token expiry.

Password reset routes intentionally avoid leaking whether an email is registered during the
forgot-password request.

## Response Patterns

Successful responses return JSON objects with explicit fields. Errors return:

```json
{
  "status": "error",
  "error": "MACHINE_READABLE_CODE",
  "message": "Human-readable message",
  "statusCode": 400,
  "code": "MACHINE_READABLE_CODE"
}
```

Validation errors include a `details.issues` array from Zod.

## Route Conventions

- Validate request bodies, params, and query strings with Zod at route boundaries.
- Use shared schemas from `@barber-saas/shared-types` when the contract is consumed by more than one app.
- Keep database table names and columns in `snake_case`; map API payloads to `camelCase`.
- Do not expose payment provider internals directly in public client responses.
- Prefer explicit status codes and typed custom errors over generic throws.

## Future Route Groups

- `/barbers`: barber profiles, services, availability.
- `/appointments`: client booking and barber appointment operations.
- `/payments`: payment intents and Stripe webhook handling.
- `/notifications`: delivery preferences and inbox state.
