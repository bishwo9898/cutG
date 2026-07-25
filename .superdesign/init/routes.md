# Route Map

Framework routing:

- Next.js App Router
- File-based routing under `apps/web/src/app`
- Public landing page plus role-specific client and barber portal routes

## Canonical Experiences

| Experience | Primary routes | Notes |
| --- | --- | --- |
| Landing | `/` | Public marketing page for discovery and conversion |
| Client portal | `/client`, `/client/barbers`, `/client/design`, `/client/appointments`, `/client/profile` | Marketplace, booking, AI hair preview, account management |
| Barber portal | `/barber/dashboard`, `/barber/dashboard/services`, `/barber/dashboard/availability`, `/barber/dashboard/mobile-service`, `/barber/dashboard/subscription` | Operational dashboard for business management |
| Auth | `/client/login`, `/client/register`, `/barber/login`, `/barber/register`, `/forgot-password`, `/reset-password`, `/verify-email` | Role-specific auth entrypoints |

## Key Route Files

| URL | File |
| --- | --- |
| `/` | `apps/web/src/app/page.tsx` |
| `/client` | `apps/web/src/app/client/page.tsx` |
| `/client/barbers` | `apps/web/src/app/client/barbers/page.tsx` |
| `/client/barbers/[barberId]` | `apps/web/src/app/client/barbers/[barberId]/page.tsx` |
| `/client/barbers/[barberId]/book` | `apps/web/src/app/client/barbers/[barberId]/book/page.tsx` |
| `/client/design` | `apps/web/src/app/client/design/page.tsx` |
| `/client/appointments` | `apps/web/src/app/client/appointments/page.tsx` |
| `/client/appointments/[appointmentId]` | `apps/web/src/app/client/appointments/[appointmentId]/page.tsx` |
| `/client/profile` | `apps/web/src/app/client/profile/page.tsx` |
| `/client/profile/addresses` | `apps/web/src/app/client/profile/addresses/page.tsx` |
| `/barber/dashboard` | `apps/web/src/app/barber/dashboard/page.tsx` |
| `/barber/dashboard/services` | `apps/web/src/app/barber/dashboard/services/page.tsx` |
| `/barber/dashboard/availability` | `apps/web/src/app/barber/dashboard/availability/page.tsx` |
| `/barber/dashboard/mobile-service` | `apps/web/src/app/barber/dashboard/mobile-service/page.tsx` |
| `/barber/dashboard/appointments` | `apps/web/src/app/barber/dashboard/appointments/page.tsx` |
| `/barber/dashboard/subscription` | `apps/web/src/app/barber/dashboard/subscription/page.tsx` |
| `/barber/dashboard/earnings` | `apps/web/src/app/barber/dashboard/earnings/page.tsx` |

## Compatibility Layer

The repo still contains legacy route shims under `/dashboard`, `/barbers`, `/appointments`, `/saved`, `/login/*`, and `/register/*`. Product docs describe these as compatibility redirects while `/client/*` and `/barber/*` remain the canonical portals.

## Route Summaries

- `/`: current public page is a generic marketplace-oriented landing page with hero copy, featured barbers, mobile service callout, barber growth CTA, and a simple pricing teaser.
- `/client`: consumer home with search, featured barbers, mobile spotlight, AI design studio teaser, and recently viewed rail.
- `/client/design`: multi-step AI Hair Studio flow for headshot upload, style selection, generation polling, before/after comparison, and saved looks.
- `/client/barbers/*`: search, public barber profiles, and booking flow that supports shop or mobile appointments.
- `/barber/dashboard`: business overview with profile status, services count, bookings, ratings, and navigation to deeper tools.
- `/barber/dashboard/mobile-service`: mobile barber configuration surface for radius, origin, fee structure, and travel settings.
- `/barber/dashboard/subscription`: tier management for `FREE`, `BASIC`, and `PREMIUM`.
