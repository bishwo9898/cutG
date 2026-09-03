# Mobile Barber

Last updated: July 13, 2026

Phase 6 adds on-demand mobile service to cutG. BASIC and PREMIUM barbers can define a travel area and fee, clients can manage service addresses, mobile appointments reserve outbound and return travel time, and active mobile visits can share foreground web GPS while the barber is on the way or servicing the appointment.

## Feature Flow

1. A BASIC or PREMIUM barber enables mobile service and saves an origin, radius, fee structure, and client notes.
2. Public search exposes a Mobile badge and supports `mobileOnly=true`.
3. The client map centers near the browser location and the client places an exact MapLibre destination pin.
4. The API reverse-geocodes the pin for a meaningful address, estimates driving distance/time, validates the radius, and calculates the travel fee.
5. The booking transaction locks the appointment slot plus required outbound and return buffer slots before writing anything.
6. The payment intent total is the service quote plus `travel_fee_cents`.
7. The barber advances a mobile visit through `CONFIRMED -> ON_THE_WAY -> ARRIVED -> IN_PROGRESS -> COMPLETED`.
8. When the barber starts the journey from the web dashboard, browser geolocation sends foreground pings every few seconds until the appointment is completed, cancelled, or manually stopped.

## Configuration

`mobile_barber_config` contains one optional configuration per barber profile:

- `is_enabled`: public availability toggle.
- `service_radius_miles`: 1 to 50 miles.
- `fee_structure`: `flat`, `per_mile`, or `free`.
- `base_fee_cents`: flat fee in cents.
- `per_mile_rate_cents`: rate in cents, charged against the rounded-up distance.
- `origin_latitude` and `origin_longitude`: center of the service area.
- `origin_address`: barber-facing label for the origin.
- `mobile_service_notes`: public preparation notes.

FREE barbers can retain a disabled configuration but cannot enable the feature. The service enforces the tier in addition to route authentication.

### Web Configuration Experience

The barber dashboard at `/dashboard/mobile-service` keeps the origin address, coordinates, marker, radius circle, and radius slider synchronized:

- Typing in the origin field opens Google Places address suggestions.
- Selecting a suggestion moves the map and service-area circle to that address.
- Clicking the map or dragging the marker updates the coordinates and reverse-geocodes the address field.
- **Use my location** requests browser location permission, centers the map on the device position, and reverse-geocodes it into the origin field.
- **Exact pin** uses street-level zoom for origin placement; **Service area** frames the configured radius without changing the saved center.
- The selected address and six-decimal coordinates remain visible below the map before saving.
- Location denial and Google Maps loading failures produce actionable messages without discarding existing settings.
- Fee structure, travel fee, public visit notes, enabled state, and service area are saved together through `PUT /barbers/me/mobile`.

Browser geolocation requires a secure context. HTTPS is required in production; `http://localhost` is permitted during local development.

## Travel Estimates

With `GOOGLE_MAPS_API_KEY` configured, the API uses Google Distance Matrix in driving mode with a current departure time. Without a key in development and test, it uses a deterministic route estimate based on Haversine distance, a 1.2 road-distance multiplier, and a 25 mph assumed speed. If Google is unavailable or rejects a distance request, the same deterministic model provides a resilient fallback. Production should still use a restricted server key.

Client estimate behavior distinguishes hard and soft failures. `OUTSIDE_SERVICE_AREA` blocks mobile
booking. Network, provider, and unexpected estimate failures display an advisory message and preserve
progress so the barber can confirm arrival details.

Fee calculation:

```text
flat:     base_fee_cents
per_mile: ceil(distance_miles) * per_mile_rate_cents
free:     0
```

The radius is validated again at booking time. Search deliberately does not use the client's address or imply that every mobile barber can reach every client.

## Buffer Algorithm

```typescript
export const calculateTravelBufferSlots = (
  travelMinutes: number,
  slotDurationMinutes: number,
): number => {
  if (travelMinutes <= 0) return 0;
  if (slotDurationMinutes <= 0) throw new Error('Slot duration must be greater than zero.');
  return Math.min(Math.ceil(travelMinutes / slotDurationMinutes), 4);
};
```

`getTravelBufferSlotTimes` walks backward from the appointment start and returns outbound slots in chronological order. `getReturnTravelBufferSlotTimes` walks forward from the appointment end so the barber is also unavailable while returning from a mobile visit. Both support midnight boundaries. A 14-minute trip against 30-minute inventory reserves one outbound slot and one return slot; a 31-minute trip reserves two of each kind. The cap is four slots per direction.

The transaction locks the selected appointment slot, the exact preceding outbound rows, and the exact following return rows using `FOR UPDATE`. It verifies every row is still `AVAILABLE`, inserts the appointment, books the selected slot, and marks buffer rows with `is_travel_buffer=true`, `travel_buffer_for=<appointment id>`, and `travel_buffer_kind=OUTBOUND|RETURN`. Any missing or unavailable row rolls back the entire transaction with `BUFFER_SLOTS_UNAVAILABLE`.

Travel buffers are excluded from public slot responses. A public mobile slot is only marked `availableForMobile=true` when the appointment slot and both buffer directions are available. Client cancellation, barber cancellation, and failed/cancelled card-payment cleanup release both buffer kinds atomically.

## Client Pin And Saved Addresses

Client addresses are owned by `users.id`. On web, browser location only selects the initial map area;
the draggable pin selects the actual destination. Saved addresses are optional recenter shortcuts
and still require pin confirmation. MapLibre renders the client map without a Google map UI, while
the API uses the private server key to reverse-geocode the pin. Exact coordinates are authoritative
and the nearest meaningful address is operational context for the barber.

The first saved address becomes the default. Deleting the default promotes the most recently
created remaining address. A partial unique index guarantees at most one default per client.

Latitude and longitude must be supplied together. The shared contracts reject half-specified coordinates, while one-time booking addresses carry the same precise pair and optional apartment/suite/unit into the appointment snapshot.

Appointment rows copy the service address, exact coordinates, reverse-geocode source, formatted address, and approximate-address flag. Removing a saved address therefore does not erase historical appointment location details.

## Live Tracking

Live tracking is foreground web tracking for now. It does not run in the background after the browser tab is closed; native background GPS is a later mobile-app upgrade.

On the barber dashboard appointment list:

- `Start journey` requests browser geolocation, transitions the mobile appointment to `ON_THE_WAY`, sends an immediate GPS ping, and starts `watchPosition`.
- Pings are accepted while the appointment is `ON_THE_WAY`, `ARRIVED`, or `IN_PROGRESS`.
- Pings include latitude, longitude, and optional accuracy, heading, and speed when the browser provides them.
- Sharing stops on `COMPLETED`, `CANCELLED`, `NO_SHOW`, page unload, or manual stop.
- If permission is denied, the barber can still update the appointment status, but the client sees that live location is unavailable.

On the client appointment detail page:

- The status timeline refetches every 5 seconds during `CONFIRMED`, `ON_THE_WAY`, `ARRIVED`, and `IN_PROGRESS`.
- Barber location refetches every 5 seconds during `ON_THE_WAY`, `ARRIVED`, and `IN_PROGRESS`.
- The map shows the destination pin first, then the live barber marker and route while the barber is traveling.
- After arrival or service start, the UI keeps the exact destination pin visible and shows the current journey state without requiring refresh.

## API

| Method   | Path                                                      | Access                   | Purpose                                                  |
| -------- | --------------------------------------------------------- | ------------------------ | -------------------------------------------------------- |
| `GET`    | `/barbers/me/mobile`                                      | BARBER                   | Read config and platform fee suggestion.                 |
| `PUT`    | `/barbers/me/mobile`                                      | BARBER, BASIC+ to enable | Create or replace config.                                |
| `POST`   | `/barbers/me/mobile/disable`                              | BARBER                   | Disable without deleting config.                         |
| `POST`   | `/barbers/me/mobile/estimate`                             | Public                   | Validate radius and return distance, time, and fee.      |
| `GET`    | `/clients/me/addresses`                                   | CLIENT                   | List owned saved addresses.                              |
| `POST`   | `/clients/me/addresses`                                   | CLIENT                   | Geocode and save an address.                             |
| `PATCH`  | `/clients/me/addresses/:addressId`                        | CLIENT                   | Update an owned address.                                 |
| `DELETE` | `/clients/me/addresses/:addressId`                        | CLIENT                   | Delete and repair the default selection.                 |
| `POST`   | `/clients/me/addresses/:addressId/set-default`            | CLIENT                   | Make an owned address the default.                       |
| `POST`   | `/clients/me/locations/reverse-geocode`                   | CLIENT                   | Resolve an exact pin to a meaningful address.            |
| `POST`   | `/barbers/me/appointments/:appointmentId/location`        | BARBER                   | Record a foreground GPS ping for an active mobile visit. |
| `GET`    | `/clients/me/appointments/:appointmentId/status-updates`  | CLIENT                   | Poll the owned appointment timeline.                     |
| `GET`    | `/clients/me/appointments/:appointmentId/barber-location` | CLIENT                   | Poll the assigned barber's latest active GPS ping.       |

Existing routes extended in Phase 6:

- `POST /clients/me/appointments`: accepts `isMobileService`, exactly one of `clientAddressId` or `clientAddressOneTime`, and returns travel/pricing details.
- `PATCH /barbers/me/appointments/:appointmentId/status`: supports `ON_THE_WAY` and `ARRIVED` only for mobile appointments.
- `GET /barbers`: accepts `mobileOnly=true` and includes sanitized `mobileService` data.
- `GET /barbers/:barberId`: includes sanitized `mobileService` data.
- Payment Intent creation includes `travel_fee_cents` in the total.

## Maps Keys

Use separate keys with least-privilege restrictions:

```env
GOOGLE_MAPS_API_KEY=
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_MAP_STYLE_URL=
```

- Server key: enable Geocoding API and Distance Matrix API; it improves client address labels and travel estimates and should be restricted by production server IP. If the key is missing, browser-restricted, quota-limited, or temporarily unavailable, exact pin coordinates still work with fallback address context.
- Mobile key: enable Places API and Maps SDK for Android/iOS; restrict to `com.cutg.mobile` and signing identifiers.
- Web Google key: reserved for future browser-only Google features. Current web client and barber maps use MapLibre.
- Map style URL: optional MapLibre style override; the default is a compact dark CARTO basemap.

Map tile attribution is legally required and remains visible in compact form. Google branding is
absent from client maps because Google is not the client map renderer.

After changing Expo public values, restart Expo with `pnpm --filter @barber-saas/mobile dev --clear`. The Android native key is injected by `apps/mobile/app.config.js`.

## Local Verification

Distance and fee estimation can be exercised without Maps keys using deterministic development
fallbacks. Confirming a new client destination pin also works without Google; a server-capable
Geocoding key only improves the street-address label shown next to the exact pin:

```bash
make setup
make dev

curl http://localhost:4000/barbers?mobileOnly=true
curl http://localhost:4000/barbers/<barber-profile-id>
```

Use `barber.test@example.com` and `client.test@example.com` with `CutgTest2026!`. Both accounts are
seeded in Danville, Kentucky so mobile visits can be tested locally from both sides without leaving
the same area. Barber Test is the fully eligible local test barber: PREMIUM, verified, mobile
enabled, fake Stripe Connect flags enabled, a flat $15 travel fee, and a 10-mile radius. Client Test
has Home and Office saved addresses. Seed data also includes near-term mobile-ready slots and one
confirmed mobile appointment for testing `Start journey`.

## Tests

Unit tests cover fee suggestions, fee structures, rounding, the four-buffer cap, outbound and return slot generation, and midnight rollover. Integration tests cover config, public discovery, address ownership, deterministic estimates, atomic buffer booking, buffer release, foreground location pings, and mobile status transitions. Tests never call Google.

```bash
pnpm test:api:local
pnpm typecheck
pnpm lint
pnpm build
```

## Planned

- Native background GPS, push alerts, and WebSocket delivery.
- Travel-time, service-area, and profitability analytics.
- Near-term availability recommendations that include travel feasibility.
- Future generalized on-demand service providers beyond barbering.
