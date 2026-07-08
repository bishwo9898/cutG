# Foundation Tracker

Last updated: July 8, 2026

This document tracks what has been built so far from the Phase 0 foundation plan and what still needs to be configured locally before the next phase.

## Current Status

Phase 0 foundation, Phase 1 authentication, and Phase 2 barber management APIs are implemented. The repository is a pnpm monorepo for a barber operations and client booking SaaS with an Express API, PostgreSQL schema, seed data, JWT authentication, shared TypeScript/Zod packages, Docker local services, and onboarding documentation.

Verified commands:

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm db:migrate
pnpm db:seed
```

Verified live endpoints:

```bash
curl http://localhost:3000/
curl http://localhost:3000/health
```

Current API root response:

```json
{
  "name": "Barber SaaS API",
  "version": "v1",
  "status": "ok",
  "links": {
    "auth": "/auth",
    "health": "/health"
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

Seed accounts use password `password123`:

- `barber1@example.com`
- `barber2@example.com`
- `barber3@example.com`
- `client1@example.com`

Not built yet:

- Appointment booking APIs
- Payment endpoints
- Stripe webhooks
- Admin endpoints
- Realtime notifications
- Production email delivery
- Refresh-token rotation or server-side refresh-token revocation
- Broader authentication and end-to-end workflow coverage

Those are intentionally future phases.

## Database

Database: PostgreSQL

Migrations:

- `apps/api/src/db/migrations/001_initial_schema.ts`
- `apps/api/src/db/migrations/002_auth_tables.ts`

The initial schema includes 9 production-oriented tables:

| Table                | Purpose                                                          |
| -------------------- | ---------------------------------------------------------------- |
| `users`              | Base identity table for barbers, clients, and admins.            |
| `barber_profiles`    | Barber business profile, ratings, location, subscription fields. |
| `services`           | Services offered by each barber.                                 |
| `availability_slots` | Barber time inventory for future booking flows.                  |
| `appointments`       | Client bookings and appointment lifecycle state.                 |
| `payments`           | Stripe-ready payment record storage.                             |
| `subscriptions`      | Barber SaaS subscription management.                             |
| `reviews`            | Client feedback tied to completed appointments.                  |
| `notifications`      | Durable notification queue for email/SMS/push/in-app later.      |

The authentication migration adds `users.password_hash` and 3 supporting tables:

| Table                       | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| `email_verification_tokens` | Six-digit, expiring, single-use email verification codes. |
| `password_reset_tokens`     | Expiring, single-use password reset codes.                |
| `token_blacklist`           | Revoked access-token JTIs retained until token expiry.    |

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
- 45 availability slots
- 20 appointments
- 10 payments
- 3 subscriptions
- 8 reviews
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

- Workspace package exists.
- TypeScript config exists.
- Placeholder source file exists at `apps/web/src/index.ts`.
- Build and typecheck scripts exist.

Important: this is not a real Next.js frontend yet. It is a placeholder workspace reserved for the frontend phase. No pages, routes, components, styles, auth screens, dashboard, booking UI, or client marketplace UI have been built yet.

Current scripts:

```bash
pnpm --filter @barber-saas/web typecheck
pnpm --filter @barber-saas/web build
```

## Mobile

Location: `apps/mobile`

Current state:

- Workspace package exists.
- TypeScript config exists.
- Placeholder source file exists at `apps/mobile/src/index.ts`.
- Build and typecheck scripts exist.

Important: this is not a React Native app yet. It is a placeholder workspace reserved for a later mobile phase.

Current scripts:

```bash
pnpm --filter @barber-saas/mobile typecheck
pnpm --filter @barber-saas/mobile build
```

## Shared Packages

### `packages/shared-types`

Purpose: shared Zod schemas and inferred TypeScript types.

Includes:

- Database table schemas
- API request/response schemas
- Authentication request/response schemas
- Shared enums
- Root exports from `src/index.ts`

Key files:

- `packages/shared-types/src/enums.ts`
- `packages/shared-types/src/database.ts`
- `packages/shared-types/src/api.ts`
- `packages/shared-types/src/auth.ts`
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

| Document                     | Purpose                                       |
| ---------------------------- | --------------------------------------------- |
| `README.md`                  | Quick project overview and startup commands.  |
| `docs/SETUP.md`              | Local developer setup and troubleshooting.    |
| `docs/DATABASE.md`           | Schema summary and ER diagram.                |
| `docs/API.md`                | Current API patterns and route conventions.   |
| `docs/ARCHITECTURE.md`       | System architecture and scaling path.         |
| `docs/DEPLOYMENT.md`         | Deployment notes and production expectations. |
| `docs/FOUNDATION_TRACKER.md` | This running tracker of what exists so far.   |

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
PORT=3000
HOST=localhost
DATABASE_URL=postgresql://barber_user:barber_password@localhost:55433/barber_saas
POSTGRES_HOST_PORT=55433
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
REDIS_HOST_PORT=6380
WEB_APP_URL=http://localhost:3000
MOBILE_APP_URL=barber-saas://
ENABLE_ANALYTICS=false
ENABLE_AI_FEATURES=false
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
STRIPE_PUBLIC_KEY=pk_test_...
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=barber-saas-dev
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

### 5. Verify the API

```bash
curl http://localhost:3000/
curl http://localhost:3000/health
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

The foundation and initial authentication backend are ready for continued implementation. The remaining natural steps from the original planning document are:

- Complete Phase 1: auth tests, production email delivery, and any frontend auth screens
- Complete Phase 2 follow-up: broader edge-case and end-to-end coverage
- Phase 3: client discovery, appointment booking, reviews
- Phase 4: real frontend app in `apps/web`
- Phase 5+: notifications, realtime flows, payments, AI-ready features

## Known Local Notes

- The API reads the root `.env` even when it is started from `apps/api`.
- `GET /` was added so browser visits to `http://localhost:3000/` no longer return `ROUTE_NOT_FOUND`.
- The API root now advertises both `/auth` and `/health`.
- `GET /health` is database-aware; if it returns `database.status = "error"`, check `DATABASE_URL`, Docker health, and port conflicts first.
- `pnpm dev` starts only the API at present; it does not start a browser frontend.
- A previous `EADDRINUSE` on port `3000` was caused by an older `tsx watch src/index.ts` process from this same project, not another application. Find future listeners with `lsof -nP -iTCP:3000 -sTCP:LISTEN`, inspect the PID, and stop only the confirmed stale watcher before restarting `pnpm dev`.
- Do not launch `pnpm dev` twice in separate terminals. The second API watcher will fail because the first one already owns port `3000`.
- Stop the active watcher with `Ctrl+C` when finished so it does not remain alive between development sessions.
- The root git status may show unrelated files outside this project because the broader parent directory appears to be under a larger git context. Keep project work scoped to `/Users/bishwobirajdallakoti/Desktop/cutg`.

## Our Endpoints so far!

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
