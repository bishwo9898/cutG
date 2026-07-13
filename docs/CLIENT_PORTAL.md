# Client Portal

Last updated: July 13, 2026

Phase 8 turns the cutG client web experience into a cohesive consumer marketplace. Canonical client routes live under `/client`; legacy `/barbers`, `/appointments`, and `/saved` routes redirect through `apps/web/src/proxy.ts`.

## Navigation And Sessions

`ClientHeader` reads the current user through the HTTP-only cookie-backed `/auth/me` proxy.

- Guests see `Sign in` and `Create account` actions.
- Authenticated clients see Discover, Appointments, Saved, an initials avatar, their first name, profile and address links, and Sign out.
- The desktop search field submits to `/client/barbers?q=<query>`.
- Mobile clients use a fixed Discover, Appointments, Saved, and Profile tab bar.
- Signing out clears the server cookies, TanStack Query cache, and returns to `/client/login`.

Barber sessions are redirected away from client-only routes by the role-aware Next.js proxy.

## Page Map

| Route                                 | Purpose                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `/client`                             | Hero search, quick filters, featured/mobile barbers, recently viewed.    |
| `/client/barbers`                     | Search filters, local presets, client-side sort, and barber-card grid.   |
| `/client/barbers/:barberId`           | Identity, trust signals, mobile service, services, slots, and reviews.   |
| `/client/barbers/:barberId/book`      | Shop or mobile booking flow from service through confirmation.           |
| `/client/appointments`                | Upcoming and past appointment cards with contextual actions.             |
| `/client/appointments/:appointmentId` | Status journey, payment, map, cancellation, and review actions.          |
| `/client/saved`                       | Saved-barber collection.                                                 |
| `/client/profile`                     | Client identity plus saved-address, favorite, and appointment summaries. |
| `/client/profile/addresses`           | Create, edit, delete, and choose a default service address.              |

## Shared Client Components

`apps/web/src/components/client-ui.tsx` owns the reusable marketplace pieces:

- `BarberCard`: photo fallback, location, verified/mobile badges, rating, starting price, categories, next slot, save, and booking actions.
- `AppointmentCard`: status, barber/service details, mobile destination, payment, and review shortcuts.
- `TravelEstimateCard`: loading skeleton, success, outside-radius, and advisory-unavailable states.
- `StatusTimeline`: chronological mobile appointment lifecycle.
- `StaticMap`: Google Static Maps image when configured and an address fallback otherwise.
- `SlotPicker`: compact available-date rail, previous/next controls, and a focused time grid.
- `PreciseLocationPicker`: Places suggestions, current-location permission, map click, draggable pin, reverse geocoding, and exact coordinate confirmation.
- `StarRating`, review cards, status badges, and booking steps.

## Mobile Booking Rules

The booking flow always passes `barber_profiles.id` as `barberId`. Address latitude and longitude are normalized to numbers before travel estimation.

`GET /barbers/search` is a compatibility alias for `GET /barbers`; both include the nearest future
`nextAvailableSlot`. `POST /barbers/me/mobile/estimate` is public and returns only calculated travel
policy data for a public barber profile.

1. The default saved address is selected automatically.
2. Address changes trigger a debounced estimate after 500 ms.
3. `OUTSIDE_SERVICE_AREA` is a hard stop and disables booking progression.
4. Other estimate failures show an advisory warning and preserve booking access.
5. The API uses Google Distance Matrix when available and deterministic local distance math when the Google request fails or no server key is configured.
6. Successful estimates filter slots for required travel lead time and show distance, drive time, travel fee, departure time, and projected finish time.
7. Booking revalidates the address, radius, slot, and travel buffers transactionally.

Google Places powers web address suggestions and browser-location reverse geocoding when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is configured. Search selection, map clicks, marker dragging, and browser location all update one authoritative address/coordinate value. The booking map follows a selected saved or one-time address at street-level zoom, and the saved-address form retains optional apartment/suite/unit details. Coordinates selected by the user are submitted with the address and preserved by the API instead of being geocoded a second time. Existing saved addresses and deterministic server travel estimates remain usable without a Maps key.

The slot picker intentionally renders only one available date's times. A horizontal date rail and compact previous/next controls replace the former full-range calendar so booking remains usable on small screens without excessive scrolling.

## Mobile App Parity

The Expo client flow mirrors web behavior:

- Travel estimates normalize coordinates and distinguish outside-radius from advisory failures.
- Saved and one-time address flows include a synchronized tappable map, draggable pin, current-location action, and exact coordinate preview.
- Advisory estimate failures no longer disable Continue or produce an invalid zero-minute mobile-slot query.
- The confirmation screen labels unknown travel fees as barber-confirmed.
- The client tabs contain Discover, Appointments, Saved, and Profile only.
- Mobile appointment detail polls active travel statuses every 30 seconds on the appointment date, animates the active timeline marker, and shows on-the-way/arrived banners and a destination map.

## Local Verification

```bash
make setup
make dev
```

Use `client1@example.com` or `client2@example.com` with `password123`. Both have Danville, Kentucky addresses. `barber1@example.com` and `barber2@example.com` provide nearby mobile-service test profiles.

Recommended flow:

1. Sign in at `http://localhost:3000/client/login`.
2. Confirm the header shows the client account menu and no guest auth links.
3. Open `/client/barbers?city=Danville&state=KY&mobileOnly=true`.
4. Select a mobile barber, choose a saved address, and verify the estimate loads.
5. Complete a booking and inspect its timeline at `/client/appointments/:appointmentId`.
