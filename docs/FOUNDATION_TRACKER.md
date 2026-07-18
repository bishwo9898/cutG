# Foundation Tracker

Last updated: July 16, 2026

This document tracks what has been built so far from the Phase 0 foundation plan and what still needs to be configured locally before the next phase.

## Current Status

Phase 0 foundation through Phase 10 AI Hair Studio are implemented, followed by the client
experience, pin-location, Stripe web checkout, and live mobile-barber tracking upgrade.
The repository is a pnpm monorepo for a barber operations and client booking platform with an
Express API, Next.js web application, Expo application, PostgreSQL schema, JWT authentication,
shared contracts, a Python Redis/RQ AI worker, private MinIO/S3-compatible image storage, isolated test
infrastructure, and onboarding documentation.

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
pnpm --filter @barber-saas/web exec next build --webpack
```

Latest automated results:

- API: 12 test files, 47 tests passed against the isolated PostgreSQL test database.
- Web: 11 test files, 24 tests passed.
- AI worker: 1 test file, 2 prompt/provider foundation tests passed.
- API, web, AI worker, mobile, shared packages: typecheck passed.
- ESLint, Prettier check, API build, mobile build, and Next.js production build passed.

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
│   ├── mobile/
│   ├── web/
├── services/
│   └── ai/
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

| Method   | Path                                               | Auth required | Purpose                                            |
| -------- | -------------------------------------------------- | ------------- | -------------------------------------------------- |
| `GET`    | `/barbers/me`                                      | Barber token  | Read the authenticated barber profile.             |
| `POST`   | `/barbers/me/profile`                              | Barber token  | Create the barber profile once.                    |
| `PATCH`  | `/barbers/me/profile`                              | Barber token  | Update barber profile fields.                      |
| `POST`   | `/barbers/me/photo`                                | Barber token  | Update the profile photo URL.                      |
| `POST`   | `/barbers/me/services`                             | Barber token  | Create a tier-limited service.                     |
| `GET`    | `/barbers/me/services`                             | Barber token  | List/filter owned services.                        |
| `GET`    | `/barbers/me/services/:serviceId`                  | Barber token  | Read one owned service.                            |
| `PATCH`  | `/barbers/me/services/:serviceId`                  | Barber token  | Update one owned service.                          |
| `DELETE` | `/barbers/me/services/:serviceId`                  | Barber token  | Soft-delete one owned service.                     |
| `GET`    | `/barbers/me/schedule`                             | Barber token  | Read weekly schedule rules.                        |
| `PUT`    | `/barbers/me/schedule`                             | Barber token  | Transactionally replace weekly schedule.           |
| `GET`    | `/barbers/me/slots`                                | Barber token  | List private slots by date range.                  |
| `POST`   | `/barbers/me/slots/generate`                       | Barber token  | Idempotently generate availability slots.          |
| `POST`   | `/barbers/me/blocked-dates`                        | Barber token  | Block a local calendar date.                       |
| `DELETE` | `/barbers/me/blocked-dates/:date`                  | Barber token  | Unblock and regenerate availability.               |
| `GET`    | `/barbers/me/appointments`                         | Barber token  | List paginated owned appointments.                 |
| `PATCH`  | `/barbers/me/appointments/:appointmentId/status`   | Barber token  | Apply allowed appointment transitions.             |
| `POST`   | `/barbers/me/appointments/:appointmentId/location` | Barber token  | Record foreground GPS during active mobile visits. |
| `POST`   | `/barbers/me/stripe/connect`                       | Barber token  | Start Stripe Connect onboarding.                   |
| `GET`    | `/barbers/me/stripe/status`                        | Barber token  | Read Connect onboarding status.                    |
| `GET`    | `/barbers/me/earnings`                             | Barber token  | Read earnings and payout summaries.                |
| `GET`    | `/barbers/me/subscription`                         | Barber token  | Read subscription status and features.             |
| `POST`   | `/barbers/me/subscription/checkout`                | Barber token  | Create subscription checkout URL.                  |
| `POST`   | `/barbers/me/subscription/cancel`                  | Barber token  | Cancel renewal at period end.                      |
| `POST`   | `/barbers/me/subscription/resume`                  | Barber token  | Resume renewal.                                    |
| `GET`    | `/barbers/me/analytics`                            | Basic+ token  | Subscription-gated analytics placeholder.          |
| `GET`    | `/barbers/:barberId`                               | No            | Read sanitized public barber profile.              |
| `GET`    | `/barbers/:barberId/services`                      | No            | List active public services.                       |
| `GET`    | `/barbers/:barberId/slots`                         | No            | List safe public availability.                     |
| `GET`    | `/barbers/:barberId/reviews`                       | No            | List public reviews and rating summary.            |

Current Phase 3 client routes:

| Method   | Path                                                      | Auth required | Purpose                                                 |
| -------- | --------------------------------------------------------- | ------------- | ------------------------------------------------------- |
| `GET`    | `/clients/me`                                             | Client token  | Read the authenticated client profile.                  |
| `GET`    | `/clients/me/saved-barbers`                               | Client token  | List saved barbers.                                     |
| `POST`   | `/clients/me/saved-barbers`                               | Client token  | Save a barber.                                          |
| `DELETE` | `/clients/me/saved-barbers/:barberId`                     | Client token  | Remove a saved barber.                                  |
| `POST`   | `/clients/me/appointments`                                | Client token  | Book an appointment atomically.                         |
| `GET`    | `/clients/me/appointments`                                | Client token  | List paginated client appointments.                     |
| `GET`    | `/clients/me/appointments/:appointmentId`                 | Client token  | Read one owned appointment.                             |
| `GET`    | `/clients/me/appointments/:appointmentId/status-updates`  | Client token  | Poll an owned appointment timeline.                     |
| `GET`    | `/clients/me/appointments/:appointmentId/barber-location` | Client token  | Poll active barber GPS for an owned mobile appointment. |
| `DELETE` | `/clients/me/appointments/:appointmentId`                 | Client token  | Cancel pending/confirmed appointments.                  |
| `POST`   | `/clients/me/reviews`                                     | Client token  | Review a completed owned appointment.                   |
| `GET`    | `/clients/me/payment-history`                             | Client token  | List payment history.                                   |

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

Phase 7 adds:

- Public marketing landing page with client/barber CTAs, mobile-service positioning, featured barbers, plan preview, and SEO metadata
- Canonical `/barber/*` and `/client/*` portals with distinct auth copy, role-locked registration, protected routing, wrong-role handling, and legacy `308` redirects
- Cross-role account switching through auth pages, stale-role-cookie recovery, full-navigation login handoff, and explicit network/error feedback
- Five-step web mobile booking with appointment type, saved/one-time address, Places autocomplete, travel estimate, mobile-aware slots, and fee breakdown
- Client-side booking time ranges, projected finish times, travel lead timing, current-location autofill, and selected-destination review
- Web saved-address management with Places search, current-location autofill, and polled mobile appointment timeline with destination map
- Native appointment-type selection, connected address/estimate flow, mobile-compatible slot filtering, fee-aware confirmation/payment, timeline polling, and native destination map
- Public mobile policy, advisory mobile-slot availability, and client appointment timeline API endpoints
- Shared API-client methods and typed web/native response models
- Portal architecture documentation in `docs/PORTALS.md`

Phase 8 adds:

- Resilient Google Distance Matrix integration with deterministic local fallback on missing keys, provider errors, or network failures
- Hard `OUTSIDE_SERVICE_AREA` handling and advisory non-radius estimate failures on web and native booking
- Session-aware client header with search, account avatar/menu, profile/address links, and complete sign-out behavior
- Consumer marketplace home with quick filters, featured/mobile rails, how-it-works, skeletons, and recently viewed barbers
- Rich reusable barber and appointment cards with trust, price, category, next-slot, save, payment, and review actions
- Search rating/price/mobile/verified filters plus relevant, rating, price, and mobile-first sort controls
- Tabbed public barber profile, mobile-service callout, service-specific booking links, and mobile sticky booking action
- Client profile activity summary and complete address create/edit/delete/default controls
- Shared precise-location picker with Places dropdown, current-location permission, reverse geocoding, map clicks, draggable pins, and exact coordinate confirmation
- Coordinate-aware client address and one-time booking contracts that preserve a selected map point and optional apartment/suite/unit through API persistence
- Compact booking calendar with an available-date rail, previous/next navigation, and a focused time grid
- Reusable web travel card, status timeline, and Google Static Maps fallback components
- Native advisory travel fallback, fee-confirmation state, travel-aware slot fallback, and animated active appointment timeline
- Detailed client portal documentation in `docs/CLIENT_PORTAL.md`
- Public `/barbers/search` compatibility alias; barber search and public profiles retain `nextAvailableSlot` and sanitized `mobileService`

Phase 9 adds:

- Migration `007_new_features.ts` with bounded barber GPS pings, client hair designs, and appointment style references
- Foreground native GPS broadcasting and ownership-scoped client live-location polling
- Web live tracking with destination/barber markers, remaining ETA, and resilient static-map fallback
- Placeholder Hair Design Studio on web/mobile with presets, saved descriptions, and appointment attachment
- Correct appointment service/travel/total display based on immutable `price_quoted` and cent-based travel fees
- Categorized barber service menus on web/mobile, including color services and collapsed inactive rows
- Polished status timeline, both-party notes, quick rebooking, and availability labels

The July 15 client upgrade adds:

- Migration `008_client_checkout.ts` and explicit `CASH`/`CARD` appointment payment methods
- Server-side authenticated reverse geocoding for exact client destination pins
- MapLibre client booking, saved-address, appointment, and live-tracking maps
- Progressive client booking with a sticky summary and Stripe Payment Element card capture
- Idempotent payment-intent retries using the real Stripe client secret
- Pending-intent cancellation when an unpaid card appointment is cancelled
- Matte-black and warm-cream client styling with no hover layout movement
- Three optimized local barber cover assets and resilient image fallbacks
- Coordinate-backed reverse-geocode fallback for missing, browser-restricted, quota-limited, or unavailable Google server geocoding keys

The July 16 live mobile tracking upgrade adds:

- Migration `009_live_mobile_tracking.ts` for mobile address metadata and typed outbound/return travel buffers
- Mobile booking reservation of both outbound and return travel inventory
- Public mobile-slot filtering that only marks slots mobile-ready when both buffer directions are available
- Foreground web GPS tracking from the barber dashboard during `ON_THE_WAY`, `ARRIVED`, and `IN_PROGRESS`
- 5-second client polling for active mobile appointment status and barber location without manual refresh
- Coordinate-backed appointment address snapshots with `formattedAddress`, `source`, and `isApproximateAddress`
- Seeded fake local Stripe Connect eligibility for `barber.test@example.com` so online-payment UI can be tested locally
- Seed cleanup is scoped to seed-owned users, profiles, and dependent rows instead of wiping every local row

Phase 10 AI Hair Studio adds:

- Migration `010_ai_hair_studio.ts` for consented scans, private captures, generation state, and usage accounting
- `services/ai`, a horizontally scalable FastAPI and Python RQ service using the existing Redis service
- Private local MinIO storage with presigned browser uploads and short-lived authorized preview URLs
- Deterministic zero-cost mock provider and production fal.ai FLUX Kontext provider behind one interface
- Three-angle camera-only web capture with local MediaPipe pose guidance and quality rejection
- Controlled hairstyle recommendations, one-image generation, progress polling, explicit retry, deletion, and appointment attachment
- One-active-job, three-attempt daily defaults, idempotency keys, a kill switch, and optional monthly cost ceiling
- 24-hour raw-scan retention cleanup and no automatic retry after uncertain paid provider submission
- Versioned hair-only prompts that preserve identity and prohibit sensitive-trait inference

Seed accounts use password `password123`:

- `barber.test@example.com` (`Barber Test`)
- `client.test@example.com` (`Client Test`)

Local seeded geography for mobile-service testing:

- `barber.test@example.com` and `client.test@example.com` are centered in Danville, Kentucky.
- `client.test@example.com` includes Home and Office saved local addresses for shop and mobile-booking testing.
- `barber.test@example.com` is the fully eligible local test barber: PREMIUM, verified, mobile enabled, fake local Stripe Connect flags, online payment visible in UI, and near-term mobile-ready availability.

Not built yet:

- Production fal.ai acceptance testing with funded credentials and real client consent review
- Self-hosted GPU hairstyle generation or Python model adapter
- Native Expo single-headshot upload flow
- Native push notification delivery
- Real-time slot updates through WebSockets
- Native background GPS, push notifications, and WebSocket delivery for mobile journeys
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
- `apps/api/src/db/migrations/007_new_features.ts`
- `apps/api/src/db/migrations/008_client_checkout.ts`
- `apps/api/src/db/migrations/009_live_mobile_tracking.ts`
- `apps/api/src/db/migrations/010_ai_hair_studio.ts`

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

The Phase 9 migration adds:

| Table                   | Purpose                                                        |
| ----------------------- | -------------------------------------------------------------- |
| `barber_location_pings` | Latest foreground GPS samples for active mobile journeys.      |
| `client_hair_designs`   | Saved placeholder AI style briefs and appointment attachments. |

It also extends appointments with `style_reference_id` and `style_notes`.

The client checkout migration adds `appointment_payment_method_enum` with `CASH` and `CARD`, a
non-null `appointments.payment_method` defaulting to `CASH`, and an index for payment-method
reporting and operations. Existing rows are migrated safely to cash before seeded payment records
are marked as card appointments.

The live mobile tracking migration adds `availability_slots.travel_buffer_kind` (`OUTBOUND` or
`RETURN`) plus appointment address metadata fields for `service_address_formatted`,
`service_address_source`, and `service_address_is_approximate`.

The AI Hair Studio migration adds:

| Table                     | Purpose                                                       |
| ------------------------- | ------------------------------------------------------------- |
| `hair_scan_sessions`      | Consent, preferences, recommendation state, and expiry.       |
| `hair_scan_captures`      | Private headshot object metadata and quality scores.          |
| `hair_design_generations` | Durable idempotent provider jobs, outputs, usage, and errors. |
| `ai_usage_events`         | Provider usage and estimated cost ledger.                     |

It extends `client_hair_designs` with the current generation, private generated asset key, failure
metadata, and soft deletion while preserving existing text briefs and appointment attachments.

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

- 1 barber user and profile
- 1 client user
- 4 services
- recurring barber schedules
- future blocked dates
- approximately two weeks of availability slots
- 1 confirmed mobile appointment with outbound and return travel buffers
- 1 subscription
- 1 saved-barber example
- 1 notification

Appointment status mix:

- 1 `CONFIRMED` mobile appointment owned by `client.test@example.com` and `barber.test@example.com`

Payment record mix:

- No seeded payment rows. The test barber is payment-eligible so card checkout can be tested with a new booking.

## Frontend

Location: `apps/web`

Current state:

- Next.js 16 App Router with TypeScript and Tailwind CSS
- HTTP-only cookie authentication through Next.js route handlers
- Canonical client and barber auth under `/client/*` and `/barber/*`
- Role-aware HTTP-only session metadata and protected-route redirects; backend role authorization remains authoritative
- Client/barber registration, verification, login, and password recovery
- Responsive protected dashboard shell
- Barber dashboard home, profile, services, availability, appointments, and public-preview screens
- Client marketplace homepage, search, barber profile, booking flow, appointments, appointment detail, and saved barbers
- Phase 8 featured/mobile discovery rails, recently viewed history, rich cards, profile tabs, sorting, and loading skeletons
- Public conversion-focused landing page at `/` and client saved-address management
- Session-aware client portal navigation with header search, account dropdown, sign out, and a stable mobile bottom bar
- Barber payment setup, earnings, and subscription management pages
- Responsive Mobile Service settings with Places address autocomplete, current-location permission, reverse geocoding, draggable origin, exact-pin/service-area map modes, editable radius, travel fees, and client notes
- Browser-side forms and state for profile/service/schedule workflows
- Browser-side forms and state for client booking, cancellation, saved barbers, and reviews
- Browser-side payment-intent, refund, Connect onboarding, and subscription checkout actions
- Browser Stripe Payment Element checkout with cash/card choice and appointment-detail retry
- Pin-first MapLibre booking and saved-address selection with browser geolocation fallback
- Barber dashboard foreground GPS sharing for active mobile appointments
- Client appointment detail 5-second status and live-location polling for mobile visits
- Local optimized barber cover images with fixed-ratio loading and error fallback
- Next.js API proxy routes for login, logout, and backend requests
- TanStack Query server state and React Hook Form validation
- Shared transport-independent API client package
- AI Hair Studio headshot uploader with consent, 18+ confirmation, server-side quality checks, preferences, recommendations, progress, comparison, retry, delete, and appointment attachment

Important distinction: web and native card capture are implemented. Live destination charges still
require real Stripe test/production credentials, completed barber Connect onboarding, and webhook
delivery.

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
- Five-step native mobile-booking flow, synchronized precise-location map, advisory estimate fallback, and animated polled status timeline with destination map
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
- MinIO private S3-compatible storage plus one-shot private bucket initialization

PostgreSQL, Redis, and MinIO include health checks and persistent Docker volumes.

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

| Document                     | Purpose                                                                  |
| ---------------------------- | ------------------------------------------------------------------------ |
| `README.md`                  | Quick project overview and startup commands.                             |
| `docs/SETUP.md`              | Local developer setup and troubleshooting.                               |
| `docs/DATABASE.md`           | Schema summary and ER diagram.                                           |
| `docs/API.md`                | Current API patterns and route conventions.                              |
| `docs/ARCHITECTURE.md`       | System architecture and scaling path.                                    |
| `docs/BARBERS.md`            | Barber schedule, slot, blocking, and status behavior.                    |
| `docs/CLIENTS.md`            | Client discovery, booking, cancellation, and reviews.                    |
| `docs/CLIENT_PORTAL.md`      | Client navigation, pages, components, and UX rules.                      |
| `docs/PAYMENTS.md`           | Stripe intents, Connect, webhooks, refunds, and fees.                    |
| `docs/SUBSCRIPTIONS.md`      | Tier features, checkout, billing, and gates.                             |
| `docs/DEPLOYMENT.md`         | Deployment notes and production expectations.                            |
| `docs/MOBILE.md`             | Expo mobile setup, flows, Stripe, and limitations.                       |
| `docs/MOBILE_BARBER.md`      | Mobile service, maps, addresses, fees, and buffers.                      |
| `docs/GPS_TRACKING.md`       | Foreground GPS lifecycle, API, storage, and privacy.                     |
| `docs/HAIR_DESIGN.md`        | Implemented AI studio, privacy, queue, storage, and provider operations. |
| `docs/PORTALS.md`            | Canonical web portals, redirects, and role routing.                      |
| `docs/FOUNDATION_TRACKER.md` | This running tracker of what exists so far.                              |
| `docs/ROADMAP.md`            | Forward-looking product and engineering plan.                            |

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
NEXT_PUBLIC_MAP_STYLE_URL=
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

`make setup` installs dependencies, creates `.env` only when it is missing, starts PostgreSQL,
Redis, and MinIO, migrates, and seeds. `make dev` starts API, web, and the AI worker locally for fast
reloads.

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

The foundation through Phase 10, including dual portals, Mobile Barber booking/live tracking, and
the web AI Hair Studio, is ready for continued implementation. The remaining natural steps are:

- Complete simulator/device QA and live Stripe/Google Maps acceptance testing with restricted keys
- Native background GPS, WebSockets, and push notifications
- Paid fal.ai quality/privacy acceptance testing, travel analytics, and AI-assisted near-term availability

## Known Local Notes

- The API reads the root `.env` even when it is started from `apps/api`.
- `GET /` was added so browser visits to the API root no longer return `ROUTE_NOT_FOUND`.
- The API root now advertises `/auth`, `/barbers`, `/clients`, `/health`, and `/payments`.
- `GET /health` is database-aware; if it returns `database.status = "error"`, check `DATABASE_URL`, Docker health, and port conflicts first.
- `pnpm dev` starts the API, web app, and AI worker through `concurrently`.
- AI studio: `http://localhost:3000/client/design`; local `AI_PROVIDER=mock` incurs no API cost.
- MinIO API: `http://localhost:9000`; local console: `http://localhost:9001`.
- Frontend URL: `http://localhost:3000`.
- Client sign in: `http://localhost:3000/client/login`; barber sign in: `http://localhost:3000/barber/login`.
- Client marketplace: `http://localhost:3000/client`; barber dashboard: `http://localhost:3000/barber/dashboard`.
- Client and barber web maps use MapLibre and an optional `NEXT_PUBLIC_MAP_STYLE_URL`; compact provider attribution remains visible.
- Mobile booking stores exact pin coordinates even when Google reverse geocoding is unavailable; Google only improves the supporting address label.
- Stripe card checkout requires completed barber Connect onboarding in addition to populated Stripe environment values.
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
POST /barbers/me/appointments/:appointmentId/location
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
GET /barbers/:barberId/mobile
GET /barbers/search
GET /clients/me
GET /clients/me/hair-studio/config
POST /clients/me/hair-scans
GET /clients/me/hair-scans/:scanId
POST /clients/me/hair-scans/:scanId/captures/presign
POST /clients/me/hair-scans/:scanId/captures/:captureId/complete
POST /clients/me/hair-scans/:scanId/complete
POST /clients/me/designs/generate
GET /clients/me/designs/:designId
POST /clients/me/designs/:designId/retry
DELETE /clients/me/designs/:designId
POST /clients/me/locations/reverse-geocode
GET /clients/me/saved-barbers
POST /clients/me/saved-barbers
DELETE /clients/me/saved-barbers/:barberId
POST /clients/me/appointments
GET /clients/me/appointments
GET /clients/me/appointments/:appointmentId
GET /clients/me/appointments/:appointmentId/status-updates
GET /clients/me/appointments/:appointmentId/barber-location
DELETE /clients/me/appointments/:appointmentId
POST /clients/me/reviews
GET /clients/me/payment-history
POST /clients/me/designs
GET /clients/me/designs
POST /clients/me/designs/:designId/attach
POST /payments/create-intent
GET /payments/config
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
