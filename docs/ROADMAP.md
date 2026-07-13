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

Status: Complete

- [x] Barber discovery and search API
- [x] Public marketplace and barber profile pages
- [x] Transactional booking with row-level slot locking
- [x] Booking conflict prevention
- [x] Client appointment history and cancellation policies
- [x] Reviews tied to completed appointments

Acceptance criteria:

- Two clients cannot book the same slot under concurrent requests.
- A booking records an immutable service price and duration.
- Cancellation consistently releases eligible slots.
- Public responses never expose private barber or client fields.

## Milestone 5: Payments And Mobile

Status: Complete

- [x] Stripe payment and webhook lifecycle
- [x] Subscription billing and self-service plan changes
- [x] Expo mobile application for client and barber workflows

## Milestone 6: Mobile Barber

Status: Complete (July 10, 2026)

- [x] BASIC+ travel-area configuration with native and web maps
- [x] Client saved addresses and address selection during booking
- [x] Distance/time estimates, separate travel fees, and Stripe total integration
- [x] Atomic preceding travel buffers and mobile lifecycle states
- [x] Mobile-only discovery and sanitized public configuration

## Milestone 7: Dual Portals And Complete Mobile Booking

Status: Complete (July 12, 2026)

- [x] Public landing page and canonical barber/client web portals
- [x] Role-specific authentication and compatibility redirects
- [x] Web and native five-step mobile booking
- [x] Mobile-aware availability previews
- [x] Polled appointment travel-status timelines and destination maps

## Milestone 8: Client Marketplace Polish

Status: Complete (July 12, 2026)

- [x] Resilient web and native travel estimates with deterministic fallback
- [x] Session-aware client navigation and account menu
- [x] Premium discovery home, barber cards, search filters, and sorting
- [x] Tabbed barber profiles and polished five-step mobile booking
- [x] Appointment action cards, status journeys, polling, and map fallback
- [x] Client profile and complete saved-address management

Next: realtime GPS streaming, WebSocket updates, and push notifications.
