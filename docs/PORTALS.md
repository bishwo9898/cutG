# Web Portals

Last updated: July 12, 2026

cutG has one public landing page and two role-specific web portals. Both portals use the same Express API and HTTP-only Next.js session cookies, while the API remains the authority for authentication and authorization.

## Canonical URLs

| Experience | Public/auth routes                                                                             | Protected routes                                               |
| ---------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Landing    | `/`                                                                                            | None                                                           |
| Barber     | `/barber/login`, `/barber/register`, `/barber/forgot-password`                                 | `/barber/dashboard/*`                                          |
| Client     | `/client`, `/client/login`, `/client/register`, `/client/forgot-password`, `/client/barbers/*` | `/client/appointments/*`, `/client/saved`, `/client/profile/*` |

Barber routes use the operational dashboard shell. Client routes use the marketplace navigation and consumer booking interface. Registration hardcodes the selected portal role; users never choose a role from a form dropdown.

## Session Routing

The Next.js BFF stores access and refresh tokens in HTTP-only cookies and stores `cutg_role` as HTTP-only session metadata. The proxy uses that role only for navigation:

- Unauthenticated barber dashboard requests redirect to `/barber/login`.
- Unauthenticated client account requests redirect to `/client/login`.
- A client session entering `/barber/*` redirects to `/client`.
- A barber session entering `/client/*` redirects to `/barber/dashboard`.
- Login, registration, and password-recovery pages remain reachable across roles so a person can deliberately switch accounts without first clearing cookies.
- Stale role metadata without an access or refresh token is ignored and cannot block either auth portal.
- API middleware still verifies the signed JWT and required role for every protected API operation.

Successful login performs a full browser navigation after the BFF sets HTTP-only cookies. Auth forms handle unavailable or unreadable API responses explicitly instead of leaving a submit button with no visible outcome.

## Legacy Redirects

The proxy preserves old bookmarks with HTTP `308` redirects:

| Legacy prefix      | Canonical prefix       |
| ------------------ | ---------------------- |
| `/dashboard`       | `/barber/dashboard`    |
| `/barbers`         | `/client/barbers`      |
| `/appointments`    | `/client/appointments` |
| `/saved`           | `/client/saved`        |
| `/login/barber`    | `/barber/login`        |
| `/login/client`    | `/client/login`        |
| `/register/barber` | `/barber/register`     |
| `/register/client` | `/client/register`     |

Query strings and trailing path segments are retained.

## Client Mobile Booking

The web booking route is `/client/barbers/:barberId/book`:

1. Select a service.
2. Choose shop or mobile service when mobile service is enabled.
3. For mobile service, choose a saved address or a Google Places result and review the travel estimate.
4. Choose a slot. Mobile requests include `travelMinutes`, and slots without available preceding travel buffers are omitted.
5. Review service fee, travel fee, total, destination, time, and notes; confirm the appointment and continue to payment when Stripe is available.

Saved addresses are managed at `/client/profile/addresses`. Mobile appointment details poll the status timeline every 30 seconds while a same-day visit is confirmed, on the way, or arrived.

## Source Layout

Canonical portal route modules live under `apps/web/src/app/barber` and `apps/web/src/app/client`. During the compatibility period, small route modules reuse the established dashboard and marketplace page implementations; `apps/web/src/proxy.ts` prevents users from entering legacy URLs directly.
