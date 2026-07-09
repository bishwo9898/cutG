# Product Roadmap

Last updated: July 8, 2026

## Milestone 1: Platform Foundation

Status: Complete

- [x] pnpm monorepo with independently buildable API, web, mobile, and shared packages
- [x] PostgreSQL and Redis local services
- [x] API on port 4000 and web application on port 3000
- [x] Root development, lint, typecheck, test, and build commands
- [x] GitHub Actions verification
- [x] Dedicated migration-driven test database
- [x] Security headers and authentication rate limiting

Acceptance criteria:

- `pnpm lint`, `pnpm typecheck`, `pnpm test:api`, and `pnpm build` pass.
- Tests do not read or mutate development seed data.
- `pnpm dev` starts both the API and web application.

## Milestone 2: Authentication And Barber Workspace

Status: Complete

- [x] Barber registration, email verification, resend verification, and login
- [x] Forgot-password and reset-password flows
- [x] HTTP-only cookie sessions through the Next.js BFF
- [x] Protected, responsive dashboard navigation
- [x] Business profile creation and editing
- [x] Service creation, editing, activation state, and tier-limit feedback
- [x] Weekly schedule management, blocked dates, and slot generation
- [x] Appointment filtering and controlled status transitions
- [x] Public barber profile preview
- [x] Frontend component-test foundation

Acceptance criteria:

- Browser JavaScript never receives or stores access or refresh tokens.
- Public registration cannot create admin accounts.
- Unverified accounts cannot sign in.
- Every dashboard workflow has loading, empty, validation, and API-error states.

## Milestone 3: External Beta Readiness

Status: Planned

- [ ] Replace placeholder email logging with a production email provider
- [ ] Add refresh-token rotation and a server-side refresh-session store
- [ ] Revoke all refresh sessions after password reset or account deactivation
- [ ] Expand frontend component tests and add full Playwright barber lifecycle coverage
- [ ] Add production observability, error reporting, and deployment smoke tests

Acceptance criteria:

- Stolen or previously used refresh tokens cannot create new sessions.
- Verification and password-reset email delivery is monitored and retryable.
- The barber onboarding and daily-operation flows pass in CI against a blank database.

## Milestone 4: Client Booking

Status: Planned

- [ ] Barber discovery and search API
- [ ] Public marketplace and barber profile pages
- [ ] Transactional booking with row-level slot locking
- [ ] Booking conflict prevention and idempotency
- [ ] Client appointment history and cancellation policies
- [ ] Reviews tied to completed appointments

Acceptance criteria:

- Two clients cannot book the same slot under concurrent requests.
- A booking records an immutable service price and duration.
- Cancellation consistently releases eligible slots.
- Public responses never expose private barber or client fields.

## Milestone 5: Payments And Mobile

Status: Deferred

- [ ] Stripe payment and webhook lifecycle
- [ ] Subscription billing and self-service plan changes
- [ ] Mobile application after web contracts stabilize

Payments begin only after the booking lifecycle has sustained integration and end-to-end coverage.
