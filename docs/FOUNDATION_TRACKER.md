# Foundation Tracker

Last updated: July 11, 2026

This document tracks what has been built so far from the Phase 0 foundation plan and what still needs to be configured locally before the next phase.

## Current Status

Phase 0 foundation, Phase 1 authentication, Phase 2 barber management, Phase 3 client discovery/booking, Phase 4 payments/subscriptions, Phase 5 Expo React Native, and Phase 6 Mobile Barber are implemented. The repository is a pnpm monorepo for a barber operations and client booking platform with an Express API, Next.js web application, Expo application, PostgreSQL schema, JWT authentication, shared contracts, isolated test infrastructure, and onboarding documentation.

Verified commands:

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm test
pnpm db:migrate
pnpm db:seed
make test
pnpm --filter @barber-saas/mobile typecheck
```

Verified live endpoints:

```bash
curl http://localhost:4000/
curl http://localhost:4000/health
```

Current API root response:

```json
{
  "name": "cutG API",
  "version": "v1",
  "status": "ok",
  "links": {
    "auth": "/auth",
    "barbers": "/barbers",
    "clients": "/clients",
    "health": "/health",
    "payments": "/payments"
  }
}
```

## Repository Shape

```text
.
├── apps/
│   ├── api/
│   ├── web/
│   └── mobile/
├── packages/
│   ├── api-client/
│   ├── shared-types/
│   └── shared-utils/
├── docs/
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json
```

## Backend

Location: `apps/api`

The backend is the main active application right now.

Built so far:

- Express server in `apps/api/src/index.ts`
- Strict TypeScript config in `apps/api/tsconfig.json`
- Environment validation with Zod in `apps/api/src/config/env.ts`
- PostgreSQL connection pool in `apps/api/src/config/database.ts`
- Knex config in `apps/api/src/knexfile.ts`
- Request logging middleware
- CORS middleware
- Central error handling and 404 handling
- Graceful shutdown for `SIGINT` and `SIGTERM`
- API root route: `GET /`
- Health route: `GET /health`
- Authentication router mounted at `/auth`
- Barber router mounted at `/barbers`
- Client router mounted at `/clients`
- Payment router mounted at `/payments`
- Raw-body Stripe webhook mounted at `/webhooks/stripe`
- Registration and bcrypt password hashing
- Email verification code generation and consumption
- Login with JWT access and refresh tokens
- Bearer-token authentication middleware
- Role authorization middleware
- Access-token blacklisting on logout
- Current-user profile read and update
- Forgot/reset-password token flow
- Transactional auth database operations
- Shared Zod validation for auth requests and responses
- Consistent auth errors through the central error handler
- Dockerfile for API container builds

Current backend routes:

| Method  | Path                    | Auth required | Purpose                                         |
| ------- | ----------------------- | ------------- | ----------------------------------------------- |
| `GET`   | `/`                     | No            | API entrypoint with service metadata and links. |
| `GET`   | `/health`               | No            | API uptime plus database connectivity status.   |
| `POST`  | `/auth/register`        | No            | Create a client, barber, or admin user.         |
| `POST`  | `/auth/verify-email`    | No            | Verify an account with its six-digit code.      |
| `POST`  | `/auth/login`           | No            | Validate credentials and issue a token pair.    |
| `POST`  | `/auth/refresh`         | No            | Exchange a refresh token for an access token.   |
| `POST`  | `/auth/logout`          | Bearer token  | Blacklist the current access token.             |
| `GET`   | `/auth/me`              | Bearer token  | Return the authenticated user's profile.        |
| `PATCH` | `/auth/me`              | Bearer token  | Update name and/or phone profile fields.        |
| `POST`  | `/auth/forgot-password` | No            | Generate a password-reset code.                 |
| `POST`  | `/auth/reset-password`  | No            | Consume a reset code and replace the password.  |

Current Phase 2 barber routes:

| Method   | Path                                             | Auth required | Purpose                                   |
| -------- | ------------------------------------------------ | ------------- | ----------------------------------------- |
| `GET`    | `/barbers/me`                                    | Barber token  | Read the authenticated barber profile.    |
| `POST`   | `/barbers/me/profile`                            | Barber token  | Create the barber profile once.           |
| `PATCH`  | `/barbers/me/profile`                            | Barber token  | Update barber profile fields.             |
| `POST`   | `/barbers/me/photo`                              | Barber token  | Update the profile photo URL.             |
| `POST`   | `/barbers/me/services`                           | Barber token  | Create a tier-limited service.            |
| `GET`    | `/barbers/me/services`                           | Barber token  | List/filter owned services.               |
| `GET`    | `/barbers/me/services/:serviceId`                | Barber token  | Read one owned service.                   |
| `PATCH`  | `/barbers/me/services/:serviceId`                | Barber token  | Update one owned service.                 |
| `DELETE` | `/barbers/me/services/:serviceId`                | Barber token  | Soft-delete one owned service.            |
| `GET`    | `/barbers/me/schedule`                           | Barber token  | Read weekly schedule rules.               |
| `PUT`    | `/barbers/me/schedule`                           | Barber token  | Transactionally replace weekly schedule.  |
| `GET`    | `/barbers/me/slots`                              | Barber token  | List private slots by date range.         |
| `POST`   | `/barbers/me/slots/generate`                     | Barber token  | Idempotently generate availability slots. |
| `POST`   | `/barbers/me/blocked-dates`                      | Barber token  | Block a local calendar date.              |
| `DELETE` | `/barbers/me/blocked-dates/:date`                | Barber token  | Unblock and regenerate availability.      |
| `GET`    | `/barbers/me/appointments`                       | Barber token  | List paginated owned appointments.        |
| `PATCH`  | `/barbers/me/appointments/:appointmentId/status` | Barber token  | Apply allowed appointment transitions.    |
| `POST`   | `/barbers/me/stripe/connect`                     | Barber token  | Start Stripe Connect onboarding.          |
| `GET`    | `/barbers/me/stripe/status`                      | Barber token  | Read Connect onboarding status.           |
| `GET`    | `/barbers/me/earnings`                           | Barber token  | Read earnings and payout summaries.       |
| `GET`    | `/barbers/me/subscription`                       | Barber token  | Read subscription status and features.    |
| `POST`   | `/barbers/me/subscription/checkout`              | Barber token  | Create subscription checkout URL.         |
| `POST`   | `/barbers/me/subscription/cancel`                | Barber token  | Cancel renewal at period end.             |
| `POST`   | `/barbers/me/subscription/resume`                | Barber token  | Resume renewal.                           |
| `GET`    | `/barbers/me/analytics`                          | Basic+ token  | Subscription-gated analytics placeholder. |
| `GET`    | `/barbers/:barberId`                             | No            | Read sanitized public barber profile.     |
| `GET`    | `/barbers/:barberId/services`                    | No            | List active public services.              |
| `GET`    | `/barbers/:barberId/slots`                       | No            | List safe public availability.            |
| `GET`    | `/barbers/:barberId/reviews`                     | No            | List public reviews and rating summary.   |

Current Phase 3 client routes:

| Method   | Path                                      | Auth required | Purpose                                |
| -------- | ----------------------------------------- | ------------- | -------------------------------------- |
| `GET`    | `/clients/me`                             | Client token  | Read the authenticated client profile. |
| `GET`    | `/clients/me/saved-barbers`               | Client token  | List saved barbers.                    |
| `POST`   | `/clients/me/saved-barbers`               | Client token  | Save a barber.                         |
| `DELETE` | `/clients/me/saved-barbers/:barberId`     | Client token  | Remove a saved barber.                 |
| `POST`   | `/clients/me/appointments`                | Client token  | Book an appointment atomically.        |
| `GET`    | `/clients/me/appointments`                | Client token  | List paginated client appointments.    |
| `GET`    | `/clients/me/appointments/:appointmentId` | Client token  | Read one owned appointment.            |
| `DELETE` | `/clients/me/appointments/:appointmentId` | Client token  | Cancel pending/confirmed appointments. |
| `POST`   | `/clients/me/reviews`                     | Client token  | Review a completed owned appointment.  |
| `GET`    | `/clients/me/payment-history`             | Client token  | List payment history.                  |

Current Phase 4 payment routes:

| Method | Path                                   | Auth required    | Purpose                                         |
| ------ | -------------------------------------- | ---------------- | ----------------------------------------------- |
| `POST` | `/payments/create-intent`              | Client token     | Create mobile-compatible Stripe intent.         |
| `GET`  | `/payments/appointment/:appointmentId` | Client or barber | Read owned appointment payment status.          |
| `POST` | `/payments/refund`                     | Client token     | Refund paid appointments before completion.     |
| `POST` | `/webhooks/stripe`                     | Stripe signature | Sync Stripe payment, subscription, and Connect. |

Authentication implementation notes:

- Passwords are hashed with `bcrypt`.
- Emails are normalized to lowercase before lookup or storage.
- Access and refresh tokens are signed JWTs with distinct token types.
- Protected endpoints expect `Authorization: Bearer <access-token>`.
- `requireAuth` validates the JWT, blacklist state, user existence, and active status.
- `requireRoles(...)` is available for future role-restricted endpoints.
- Verification codes expire after 15 minutes.
- Password-reset codes expire after 60 minutes.
- Forgot-password responses do not reveal whether an account exists.
- Email delivery is currently a development placeholder: verification and reset codes are written to the API logs. SendGrid is not connected yet.

Phase 2 adds:

- Barber profile creation, updates, and profile photo URL storage
- Tier-limited service CRUD with soft deletion
- Recurring weekly schedules and blocked dates
- Idempotent availability-slot generation
- Barber appointment listing and controlled status transitions
- Sanitized public barber, service, and availability endpoints
- Vitest unit tests and Supertest database-backed integration tests
- Migration `003_barber_schedule.ts`

Phase 3 adds:

- Public barber search and public barber review listings
- Client profile read, saved barbers, appointment booking, appointment cancellation, and reviews
- Transactional booking with slot locking and conflict checks
- Slot freeing on client cancellation
- Transactional barber rating recalculation after reviews
- Next.js marketplace homepage, search, public profile, booking, appointments, and saved-barber pages
- Migration `004_client_features.ts`

Phase 4 adds:

- Stripe Payment Intent creation for appointment payments
- Cents-based platform fee and barber payout accounting
- Client payment status, refund, and payment-history endpoints
- Stripe webhook signature verification with raw request body
- Idempotent webhook event processing through `subscription_events`
- Stripe Connect onboarding/status for barber payouts
- Barber earnings dashboard and payout batch storage
- Barber subscription checkout, cancel, resume, status, and tier gates
- Next.js dashboard pages for payments, earnings, and subscriptions
- Migration `005_payments_and_subscriptions.ts`

Phase 5 adds:

- Expo SDK 51 / React Native 0.74 mobile app in `apps/mobile`
- Expo Router auth, client, and barber route groups
- SecureStore-backed JWT auth store with refresh-on-401 retry
- Token-aware mobile API wrapper built on `packages/api-client`
- TanStack Query hooks for discovery, booking, appointments, payments, and barber dashboard data
- Stripe React Native payment screen for Payment Intent confirmation
- Client mobile flows for search, profile, booking, payment, appointments, reviews, saved barbers, and profile editing
- Barber mobile flows for today, schedule, clients, business hub, services, earnings, subscription, Stripe Connect, and profile editing
- Mobile design tokens and reusable UI/card/list components
- Mobile documentation in `docs/MOBILE.md`

Phase 6 adds:

- BASIC/PREMIUM mobile-service configuration with a 1-50 mile radius
- Flat, per-mile, and free travel fees with platform suggestions
- Google Geocoding and Distance Matrix adapters plus deterministic local/test behavior
- Client address CRUD with one default address
- Appointment location snapshots, distance, travel time, and separate travel fees
- Atomic preceding travel-buffer reservation and release
- `ON_THE_WAY` and `ARRIVED` states with client notifications
- Mobile-only public discovery with sanitized service-area details
- Expo and web settings, maps, address, booking, navigation, and status interfaces
- Migration `006_mobile_barber.ts`

Seed accounts use password `password123`:

- `barber1@example.com`
- `barber2@example.com`
- `barber3@example.com`
- `client1@example.com`

Not built yet:

- Native push notification delivery
- Real-time slot updates through WebSockets
- Admin endpoints and admin mobile screens
- Production email delivery
- S3-backed barber photo upload
- App Store / Play Store release configuration
- Refresh-token rotation or server-side refresh-token revocation
- Broader end-to-end workflow coverage

Those are intentionally future phases.

## Database

Database: PostgreSQL

Migrations:

- `apps/api/src/db/migrations/001_initial_schema.ts`
- `apps/api/src/db/migrations/002_auth_tables.ts`
- `apps/api/src/db/migrations/003_barber_schedule.ts`
- `apps/api/src/db/migrations/004_client_features.ts`
- `apps/api/src/db/migrations/005_payments_and_subscriptions.ts`
- `apps/api/src/db/migrations/006_mobile_barber.ts`

The initial schema includes 9 production-oriented tables:

| Table                | Purpose                                                          |
| -------------------- | ---------------------------------------------------------------- |
| `users`              | Base identity table for barbers, clients, and admins.            |
| `barber_profiles`    | Barber business profile, ratings, location, subscription fields. |
| `services`           | Services offered by each barber.                                 |
| `availability_slots` | Barber time inventory for future booking flows.                  |
| `appointments`       | Client bookings and appointment lifecycle state.                 |
| `payments`           | Stripe-ready payment record storage.                             |
| `subscriptions`      | cutG subscription management.                                    |
| `reviews`            | Client feedback tied to completed appointments.                  |
| `notifications`      | Durable notification queue for email/SMS/push/in-app later.      |

The authentication migration adds `users.password_hash` and 3 supporting tables:

| Table                       | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| `email_verification_tokens` | Six-digit, expiring, single-use email verification codes. |
| `password_reset_tokens`     | Expiring, single-use password reset codes.                |
| `token_blacklist`           | Revoked access-token JTIs retained until token expiry.    |

The barber schedule migration adds:

| Table                  | Purpose                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `barber_schedules`     | Weekly recurring local-time working hours by barber and day. |
| `barber_blocked_dates` | Local calendar dates blocked from public availability.       |

Additional Phase 2 database changes:

- `IN_PROGRESS` added to `appointment_status_enum`.
- Unique slot constraint on `(barber_id, slot_date, start_time)` for conflict-safe slot generation.
- Updated indexes and constraints for schedules, blocked dates, slots, and appointment workflows.
- Updated-at trigger support on the new schedule and blocked-date tables.

The client feature migration adds:

| Table                  | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| `client_saved_barbers` | Client favorites, unique by client and barber. |

The payment and subscription migration adds:

| Table                 | Purpose                                                 |
| --------------------- | ------------------------------------------------------- |
| `payout_batches`      | Groups appointment earnings into barber payout batches. |
| `subscription_events` | Idempotent Stripe webhook and subscription event log.   |

The mobile barber migration adds:

| Table                  | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `mobile_barber_config` | Barber travel radius, origin, fee rules, and public notes. |
| `client_addresses`     | Geocoded saved client service addresses.                   |

It also extends appointments and availability slots with location snapshots, travel accounting, lifecycle timestamps, and internal buffer fields.

Additional Phase 4 database changes:

- Extends `payments` with platform fee, barber payout, refund, transfer, payout batch, and capture/failure fields.
- Extends `barber_profiles` with Stripe onboarding, charges, and payouts status flags.
- Extends `subscriptions` with Stripe customer, billing interval, current period, and cancel-at-period-end fields.

Database features included:

- UUID primary keys via `pgcrypto`
- PostgreSQL enum types
- Foreign keys with cascade/restrict/set-null behavior
- Check constraints for data integrity
- Indexes for lookup, sorting, filtering, and future marketplace search
- `cube` and `earthdistance` extensions for future geo-search
- `updated_at` trigger support
- JSONB metadata fields for future extensibility
- Soft delete support on `users.deleted_at`

Seed file: `apps/api/src/db/seeds/seed.ts`

Seed data currently creates:

- 3 barber users and profiles
- 12 client users
- 9 services
- recurring barber schedules
- future blocked dates
- approximately two weeks of availability slots
- 20 appointments
- 10 payments
- 3 subscriptions
- 8 reviews
- 2 saved-barber examples
- 1 paid payout batch
- 12 notifications

Appointment status mix:

- 8 `COMPLETED`
- 5 `CONFIRMED`
- 4 `PENDING`
- 2 `CANCELLED`
- 1 `NO_SHOW`

Payment record mix:

- 8 `SUCCEEDED`
- 2 `PENDING`

## Frontend

Location: `apps/web`

Current state:

- Next.js 16 App Router with TypeScript and Tailwind CSS
- HTTP-only cookie authentication through Next.js route handlers
- Separate client and barber login and registration flows under `/login/client`, `/login/barber`, `/register/client`, and `/register/barber`
- Role-aware HTTP-only session metadata and protected-route redirects; backend role authorization remains authoritative
- Client/barber registration, verification, login, and password recovery
- Responsive protected dashboard shell
- Barber dashboard home, profile, services, availability, appointments, and public-preview screens
- Client marketplace homepage, search, barber profile, booking flow, appointments, appointment detail, and saved barbers
- Barber payment setup, earnings, and subscription management pages
- Responsive Mobile Service settings with Places address autocomplete, current-location permission, reverse geocoding, draggable origin, editable radius, travel fees, and client notes
- Browser-side forms and state for profile/service/schedule workflows
- Browser-side forms and state for client booking, cancellation, saved barbers, and reviews
- Browser-side payment-intent, refund, Connect onboarding, and subscription checkout actions
- Next.js API proxy routes for login, logout, and backend requests
- TanStack Query server state and React Hook Form validation
- Shared transport-independent API client package

Important distinction: client payment intent creation is now functional, but card capture still needs Stripe SDK integration in the future mobile/web payment UI.

Current scripts:

```bash
pnpm --filter @barber-saas/web dev
pnpm --filter @barber-saas/web typecheck
pnpm --filter @barber-saas/web build
```

## Mobile

Location: `apps/mobile`

Current state:

- Expo SDK 51 app with React Native 0.74 and Expo Router
- Deep link scheme `cutg://` in `apps/mobile/app.json`
- Dark cutG design tokens and reusable React Native components
- SecureStore auth state with access-token and refresh-token persistence
- Role-specific mobile login copy and account-role verification before tokens are stored
- Token-aware API wrapper using `packages/api-client` and automatic refresh retry on `401`
- TanStack Query hooks for public barber discovery, client appointments, payments, barber dashboard, earnings, and subscriptions
- Client routes for discover/search, public barber profiles, booking, Stripe payment, appointments, saved barbers, and profile settings
- Barber routes for today, schedule, appointment lists/details, services, earnings, subscription, Stripe Connect, and profile settings
- Stripe React Native `CardField` payment screen wired to `/payments/create-intent`
- React Native Maps, Expo Location, Expo Image Picker, Expo Notifications, and Expo Linking dependencies configured
- Mobile setup documentation in `docs/MOBILE.md`

Current scripts:

```bash
pnpm --filter @barber-saas/mobile dev
pnpm --filter @barber-saas/mobile ios
pnpm --filter @barber-saas/mobile android
pnpm --filter @barber-saas/mobile typecheck
pnpm --filter @barber-saas/mobile build
```

Mobile environment file:

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Required Expo public values:

```env
EXPO_PUBLIC_API_URL=http://localhost:4000
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Shared Packages

### `packages/api-client`

Purpose: transport-independent TypeScript client for the web app and future clients.

Includes:

- API error helpers
- Authentication calls
- Current user calls
- Barber profile, service, schedule, slot, appointment, and public barber calls
- Client profile, saved-barber, booking, cancellation, and review calls
- Payment, refund, earnings, Connect, and subscription calls

Key files:

- `packages/api-client/src/index.ts`

### `packages/shared-types`

Purpose: shared Zod schemas and inferred TypeScript types.

Includes:

- Database table schemas
- API request/response schemas
- Authentication request/response schemas
- Barber request/response schemas
- Client discovery, booking, appointment, saved-barber, and review schemas
- Payment, refund, earnings, and subscription checkout schemas
- Shared enums
- Root exports from `src/index.ts`

Key files:

- `packages/shared-types/src/enums.ts`
- `packages/shared-types/src/database.ts`
- `packages/shared-types/src/api.ts`
- `packages/shared-types/src/auth.ts`
- `packages/shared-types/src/barber.ts`
- `packages/shared-types/src/client.ts`
- `packages/shared-types/src/payment.ts`
- `packages/shared-types/src/index.ts`

### `packages/shared-utils`

Purpose: common validation helpers.

Includes:

- UUID validator
- Non-empty string validator
- Money/cents validators
- US ZIP code validator
- Phone number validator
- Pagination query schema

Key files:

- `packages/shared-utils/src/validators.ts`
- `packages/shared-utils/src/index.ts`

## Local Infrastructure

Location: `docker-compose.yml`

Local services:

- PostgreSQL 15 Alpine
- Redis 7 Alpine

Both services include health checks and persistent Docker volumes.

Ports are configurable:

```env
POSTGRES_HOST_PORT=55433
REDIS_HOST_PORT=6380
```

On this machine, the local `.env` currently uses alternate ports because other local containers/processes already occupied the defaults:

```env
DATABASE_URL=postgresql://barber_user:barber_password@localhost:55433/barber_saas
POSTGRES_HOST_PORT=55433
REDIS_HOST_PORT=6380
```

The committed `.env.example` uses these alternate local ports to avoid common Mac conflicts with PostgreSQL `5432` and Redis `6379`.

## Configuration

Root configuration files:

- `package.json`: workspace scripts and dev dependencies
- `pnpm-workspace.yaml`: workspace package discovery
- `tsconfig.json`: strict shared TypeScript config
- `.eslintrc.json`: lint rules
- `.prettierrc`: formatting rules
- `.editorconfig`: editor consistency
- `.gitignore`: excludes secrets, dependencies, build output, and local artifacts
- `.vscode/settings.json`: workspace editor defaults
- `.vscode/extensions.json`: recommended extensions

Generated output:

- `dist/` directories are generated by `pnpm build`.
- Source of truth remains `src/`.

## Documentation Already Added

| Document                     | Purpose                                               |
| ---------------------------- | ----------------------------------------------------- |
| `README.md`                  | Quick project overview and startup commands.          |
| `docs/SETUP.md`              | Local developer setup and troubleshooting.            |
| `docs/DATABASE.md`           | Schema summary and ER diagram.                        |
| `docs/API.md`                | Current API patterns and route conventions.           |
| `docs/ARCHITECTURE.md`       | System architecture and scaling path.                 |
| `docs/BARBERS.md`            | Barber schedule, slot, blocking, and status behavior. |
| `docs/CLIENTS.md`            | Client discovery, booking, cancellation, and reviews. |
| `docs/PAYMENTS.md`           | Stripe intents, Connect, webhooks, refunds, and fees. |
| `docs/SUBSCRIPTIONS.md`      | Tier features, checkout, billing, and gates.          |
| `docs/DEPLOYMENT.md`         | Deployment notes and production expectations.         |
| `docs/MOBILE.md`             | Expo mobile setup, flows, Stripe, and limitations.    |
| `docs/MOBILE_BARBER.md`      | Mobile service, maps, addresses, fees, and buffers.   |
| `docs/FOUNDATION_TRACKER.md` | This running tracker of what exists so far.           |
| `docs/ROADMAP.md`            | Forward-looking product and engineering plan.         |

## What You Need To Do

### 1. Keep using pnpm

Use pnpm for this repo:

```bash
pnpm install
pnpm dev
pnpm build
```

Avoid mixing in npm/yarn lockfiles for workspace dependencies.

### 2. Fill local `.env`

Copy the example if `.env` does not exist:

```bash
cp .env.example .env
```

For local development, these values are enough:

```env
NODE_ENV=development
LOG_LEVEL=debug
PORT=4000
HOST=localhost
DATABASE_URL=postgresql://barber_user:barber_password@localhost:55433/barber_saas
POSTGRES_HOST_PORT=55433
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
REDIS_HOST_PORT=6380
WEB_APP_URL=http://localhost:3000
MOBILE_APP_URL=cutg://
ENABLE_ANALYTICS=false
ENABLE_AI_FEATURES=false
GOOGLE_MAPS_API_KEY=
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

If port `55433` or `6380` is already taken, change all related local values together:

```env
DATABASE_URL=postgresql://barber_user:barber_password@localhost:55433/barber_saas
POSTGRES_HOST_PORT=55433
REDIS_HOST_PORT=6380
```

### 3. Replace placeholder secrets before real auth/payments

Before building auth, payments, uploads, or email features, replace:

```env
JWT_SECRET=replace_with_a_random_secret_of_at_least_32_characters
JWT_EXPIRY=24h
JWT_REFRESH_EXPIRY=30d
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PLATFORM_FEE_PERCENT=10
STRIPE_PRICE_BASIC_MONTHLY=price_...
STRIPE_PRICE_BASIC_ANNUAL=price_...
STRIPE_PRICE_PREMIUM_MONTHLY=price_...
STRIPE_PRICE_PREMIUM_ANNUAL=price_...
STRIPE_SUBSCRIPTION_SUCCESS_URL=cutg://subscription/success
STRIPE_SUBSCRIPTION_CANCEL_URL=cutg://subscription/cancelled
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=cutg-dev
SENDGRID_API_KEY=
```

Authentication now actively uses `JWT_SECRET`, `JWT_EXPIRY`, and `JWT_REFRESH_EXPIRY`. Use a unique random secret of at least 32 characters; never use the example value outside throwaway local development.

Stripe and AWS remain placeholders because those features are not implemented. SendGrid is also not connected yet; auth email codes currently appear in API logs.

### 4. Start local services

```bash
docker compose up -d
```

Then run:

```bash
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Shortcut commands now exist in the root `Makefile`:

```bash
make setup
make dev
make test
make status
make logs
make down
```

`make setup` installs dependencies, creates `.env` only when it is missing, starts PostgreSQL/Redis, migrates, and seeds. `make dev` keeps application servers local through pnpm for fast reloads.

### 5. Verify the API

```bash
curl http://localhost:4000/
curl http://localhost:4000/health
```

Expected health state:

```json
{
  "status": "ok",
  "database": {
    "status": "ok"
  }
}
```

## Next Phase Readiness

The foundation through Phase 6, including web and native Mobile Barber flows, is ready for continued implementation. The remaining natural steps are:

- Complete simulator/device QA and live Stripe/Google Maps acceptance testing with restricted keys
- Phase 7: realtime GPS tracking, WebSockets, and push notifications
- Later phases: S3 uploads, travel analytics, and AI-assisted near-term availability

## Known Local Notes

- The API reads the root `.env` even when it is started from `apps/api`.
- `GET /` was added so browser visits to the API root no longer return `ROUTE_NOT_FOUND`.
- The API root now advertises `/auth`, `/barbers`, `/clients`, `/health`, and `/payments`.
- `GET /health` is database-aware; if it returns `database.status = "error"`, check `DATABASE_URL`, Docker health, and port conflicts first.
- `pnpm dev` starts both the API and the web app through `concurrently`.
- Frontend URL: `http://localhost:3000`.
- Client sign in: `http://localhost:3000/login/client`; barber sign in: `http://localhost:3000/login/barber`.
- The web Mobile Service map needs Maps JavaScript, Places, and Geocoding enabled on `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; restart `pnpm dev` after changing public env values.
- Mobile app: `pnpm --filter @barber-saas/mobile dev`; use `ios` or `android` scripts for simulators.
- API URL: `http://localhost:4000`.
- Stop active dev servers with `Ctrl+C` in the terminal running `make dev` or `pnpm dev`.
- The local branch has been committed as `cf2da00` (`Build cutG foundation and barber dashboard`) and is ahead of GitHub until `git push origin main` succeeds from an authenticated terminal.

## Our Endpoints so far

GET / → API root
GET /health → Database-aware health check
POST /auth/register
POST /auth/verify-email
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET /auth/me
PATCH /auth/me
POST /auth/forgot-password
POST /auth/reset-password
GET /barbers/me
POST /barbers/me/profile
PATCH /barbers/me/profile
POST /barbers/me/photo
POST /barbers/me/services
GET /barbers/me/services
GET /barbers/me/services/:serviceId
PATCH /barbers/me/services/:serviceId
DELETE /barbers/me/services/:serviceId
GET /barbers/me/schedule
PUT /barbers/me/schedule
GET /barbers/me/slots
POST /barbers/me/slots/generate
POST /barbers/me/blocked-dates
DELETE /barbers/me/blocked-dates/:date
GET /barbers/me/appointments
PATCH /barbers/me/appointments/:appointmentId/status
POST /barbers/me/stripe/connect
GET /barbers/me/stripe/status
GET /barbers/me/earnings
GET /barbers/me/subscription
POST /barbers/me/subscription/checkout
POST /barbers/me/subscription/cancel
POST /barbers/me/subscription/resume
GET /barbers/me/analytics
GET /barbers/:barberId
GET /barbers/:barberId/services
GET /barbers/:barberId/slots
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
GET /barbers/me/mobile
PUT /barbers/me/mobile
POST /barbers/me/mobile/disable
POST /barbers/me/mobile/estimate
GET /clients/me/addresses
POST /clients/me/addresses
PATCH /clients/me/addresses/:addressId
DELETE /clients/me/addresses/:addressId
POST /clients/me/addresses/:addressId/set-default
