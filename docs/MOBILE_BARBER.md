# Mobile Barber

Last updated: July 10, 2026

Phase 6 adds on-demand mobile service to cutG. BASIC and PREMIUM barbers can define a travel area and fee, clients can manage service addresses, and mobile appointments reserve travel time before the booked slot.

## Feature Flow

1. A BASIC or PREMIUM barber enables mobile service and saves an origin, radius, fee structure, and client notes.
2. Public search exposes a Mobile badge and supports `mobileOnly=true`.
3. A client selects a saved or one-time address during booking.
4. The API geocodes one-time addresses, estimates driving distance/time, validates the radius, and calculates the travel fee.
5. The booking transaction locks the appointment slot and every required preceding buffer slot before writing anything.
6. The payment intent total is the service quote plus `travel_fee_cents`.
7. The barber advances a mobile visit through `CONFIRMED -> ON_THE_WAY -> ARRIVED -> IN_PROGRESS -> COMPLETED`.

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

## Travel Estimates

With `GOOGLE_MAPS_API_KEY` configured, the API uses Google Distance Matrix in driving mode with a current departure time. Without a key in development and test, it uses a deterministic route estimate based on Haversine distance, a 1.2 road-distance multiplier, and a 25 mph assumed speed. Production should always use a restricted server key.

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

`getTravelBufferSlotTimes` walks backward from the appointment start and returns slots in chronological order. It supports a midnight boundary. A 14-minute trip against 30-minute inventory reserves one slot; a 31-minute trip reserves two. The cap is four slots.

The transaction locks the selected appointment slot and the exact preceding availability rows using `FOR UPDATE`. It verifies every row is still `AVAILABLE`, inserts the appointment, books the selected slot, and marks preceding rows with `is_travel_buffer=true` and `travel_buffer_for=<appointment id>`. Any missing or unavailable row rolls back the entire transaction with `BUFFER_SLOTS_UNAVAILABLE`.

Travel buffers are excluded from public slot responses. Client cancellation, barber cancellation, and payment refunds release them atomically.

## Saved Addresses

Client addresses are owned by `users.id` and store coordinates after the first geocode. The first address becomes the default. A partial update only geocodes again when physical address fields change. Deleting the default promotes the most recently created remaining address. A partial unique index guarantees at most one default per client.

Appointment rows copy the service address and coordinates. Removing a saved address therefore does not erase historical appointment location details.

## API

| Method   | Path                                           | Access                   | Purpose                                             |
| -------- | ---------------------------------------------- | ------------------------ | --------------------------------------------------- |
| `GET`    | `/barbers/me/mobile`                           | BARBER                   | Read config and platform fee suggestion.            |
| `PUT`    | `/barbers/me/mobile`                           | BARBER, BASIC+ to enable | Create or replace config.                           |
| `POST`   | `/barbers/me/mobile/disable`                   | BARBER                   | Disable without deleting config.                    |
| `POST`   | `/barbers/me/mobile/estimate`                  | BARBER or CLIENT         | Validate radius and return distance, time, and fee. |
| `GET`    | `/clients/me/addresses`                        | CLIENT                   | List owned saved addresses.                         |
| `POST`   | `/clients/me/addresses`                        | CLIENT                   | Geocode and save an address.                        |
| `PATCH`  | `/clients/me/addresses/:addressId`             | CLIENT                   | Update an owned address.                            |
| `DELETE` | `/clients/me/addresses/:addressId`             | CLIENT                   | Delete and repair the default selection.            |
| `POST`   | `/clients/me/addresses/:addressId/set-default` | CLIENT                   | Make an owned address the default.                  |

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
```

- Server key: enable Geocoding API and Distance Matrix API; restrict by production server IP.
- Mobile key: enable Places API and Maps SDK for Android/iOS; restrict to `com.cutg.mobile` and signing identifiers.
- Web key: enable Maps JavaScript API; restrict by allowed HTTP referrers.

Use three distinct keys. For local web development, allow `http://localhost:3000/*` and optionally `http://127.0.0.1:3000/*` on the web key. A key with HTTP-referrer restrictions cannot call server-side Geocoding or Places REST endpoints.

After changing Expo public values, restart Expo with `pnpm --filter @barber-saas/mobile dev --clear`. The Android native key is injected by `apps/mobile/app.config.js`.

## Local Verification

The feature can be exercised without Maps keys using development mocks:

```bash
make setup
make dev

curl http://localhost:4000/barbers?mobileOnly=true
curl http://localhost:4000/barbers/<barber-profile-id>
```

Use `barber1@example.com`, `barber2@example.com`, or `client1@example.com` with `password123`. Barber 1 has a flat $15 travel fee and a 10-mile radius. Barber 2 uses $2 per mile and a 5-mile radius. Client 1 has Home and Office addresses.

## Tests

Unit tests cover fee suggestions, fee structures, rounding, the four-buffer cap, chronological slot generation, and midnight rollover. Integration tests cover config, public discovery, address ownership, deterministic estimates, atomic buffer booking, and mobile status transitions. Tests never call Google.

```bash
pnpm test:api:local
pnpm typecheck
pnpm lint
pnpm build
```

## Planned

- Phase 7: GPS streaming while `ON_THE_WAY`, WebSocket status delivery, and push alerts.
- Phase 8: travel-time, service-area, and profitability analytics.
- Phase 9: near-term availability recommendations that include travel feasibility.
- Future: generalized on-demand service providers beyond barbering.
