# API

The Phase 1 API exposes foundation infrastructure and authentication/user-management routes.

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
```

## Phase 2 Barber Routes

All `/barbers/me/*` routes require a bearer token for a `BARBER` account. Public routes use the
`barber_profiles.id` UUID. Invalid Zod input returns HTTP `422`.

| Method   | Path                                             | Purpose                             |
| -------- | ------------------------------------------------ | ----------------------------------- |
| `GET`    | `/barbers/me`                                    | Read the current barber profile.    |
| `POST`   | `/barbers/me/profile`                            | Create a profile once.              |
| `PATCH`  | `/barbers/me/profile`                            | Update profile fields.              |
| `POST`   | `/barbers/me/photo`                              | Store a validated photo URL.        |
| `POST`   | `/barbers/me/services`                           | Create a tier-limited service.      |
| `GET`    | `/barbers/me/services`                           | List/filter owned services.         |
| `GET`    | `/barbers/me/services/:serviceId`                | Read an owned service.              |
| `PATCH`  | `/barbers/me/services/:serviceId`                | Update an owned service.            |
| `DELETE` | `/barbers/me/services/:serviceId`                | Soft-delete an owned service.       |
| `GET`    | `/barbers/me/schedule`                           | Read the weekly schedule.           |
| `PUT`    | `/barbers/me/schedule`                           | Replace the weekly schedule.        |
| `GET`    | `/barbers/me/slots`                              | List a date range of slots.         |
| `POST`   | `/barbers/me/slots/generate`                     | Idempotently generate slots.        |
| `POST`   | `/barbers/me/blocked-dates`                      | Block a local calendar date.        |
| `DELETE` | `/barbers/me/blocked-dates/:date`                | Unblock and regenerate a date.      |
| `GET`    | `/barbers/me/appointments`                       | List paginated appointments.        |
| `PATCH`  | `/barbers/me/appointments/:appointmentId/status` | Apply an allowed status transition. |
| `GET`    | `/barbers/:barberId`                             | Read a sanitized public profile.    |
| `GET`    | `/barbers/:barberId/services`                    | List active public services.        |
| `GET`    | `/barbers/:barberId/slots`                       | List safe public availability.      |

Dates use `YYYY-MM-DD`; times use local `HH:MM`. Private slot ranges accept `startDate` and
`endDate`, inclusively, with at most a 30-day difference. Appointment lists support `status`,
`date`, `startDate`, `endDate`, `page`, and `limit` (maximum 50). Public responses exclude precise
location, Stripe fields, metadata, and client information.

Returns API and database health.

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
