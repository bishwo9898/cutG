# Clients

The client marketplace covers discovery, saved barbers, appointment booking, cancellation, reviews,
and the polished Phase 8 consumer portal. See `docs/CLIENT_PORTAL.md` for page-level UI behavior.

## Client Identity

Clients use the same authentication routes as barbers:

```http
POST /auth/register
POST /auth/login
POST /auth/logout
GET /auth/me
```

Register with `userType: "CLIENT"`. Client-only routes require:

```http
Authorization: Bearer <clientAccessToken>
```

Barber tokens are rejected from `/clients/me/*` routes with `403`.

## Discovery

Public marketplace search is available at:

```http
GET /barbers
```

Supported filters:

- `q`: search `business_name` and `bio`.
- `city`, `state`: case-insensitive exact matches.
- `category`: active service category.
- `minRating`: minimum public rating.
- `maxPrice`: barber has at least one active service at or below this price.
- `mobileOnly`: only barbers with enabled mobile service.
- `verified`: verified profiles only.
- `page`, `limit`: pagination, with max limit `48`.

Public barber details remain split by concern:

```http
GET /barbers/:barberId
GET /barbers/:barberId/services
GET /barbers/:barberId/slots
GET /barbers/:barberId/reviews
```

The public `barberId` is always `barber_profiles.id`.

## Saved Barbers

Clients can save and remove favorite barbers:

```http
GET /clients/me/saved-barbers
POST /clients/me/saved-barbers
DELETE /clients/me/saved-barbers/:barberId
```

Saved barber rows live in `client_saved_barbers` and are unique by `(client_id, barber_id)`.
Duplicate saves return `409 ALREADY_SAVED`. Removing a barber that was not saved returns
`404 NOT_SAVED`.

## Booking

Clients book through:

```http
POST /clients/me/appointments
```

Request body:

```json
{
  "barberId": "uuid",
  "serviceId": "uuid",
  "availabilitySlotId": "uuid",
  "clientNotes": "Optional note"
}
```

Booking is atomic. Inside one transaction the API:

1. Confirms the barber exists, is active, and is not soft-deleted.
2. Confirms the service belongs to the barber and is active.
3. Locks the selected availability slot with `FOR UPDATE`.
4. Rejects unavailable, past, or too-short slots.
5. Rejects overlapping client appointments in `PENDING` or `CONFIRMED`.
6. Inserts a `PENDING` appointment with `payment_status = PENDING`.
7. Marks the slot `BOOKED` and attaches `appointment_id`.
8. Creates placeholder notifications for the client and barber.

Mobile bookings add one address decision step before slot selection:

- Choose a saved address, search a one-time address, use browser location autofill, click the map, or drag the exact-location pin.
- Places suggestions and map interactions share one selected value; accepted latitude/longitude coordinates are persisted without a second geocode.
- The web flow estimates distance, travel minutes, fee, travel-ready slots, barber departure timing, and projected finish time before confirmation.
- Saved addresses can also be managed separately from `/client/profile/addresses`.
- Address changes debounce travel estimation by 500 ms. Only `OUTSIDE_SERVICE_AREA` blocks progress;
  other estimate failures remain advisory and let the client continue.
- Google travel failures fall back to the deterministic local distance model, matching no-key local
  development behavior.

No payment is collected in Phase 3. The web UI labels bookings as pay-at-the-shop.

## Cancellation

Clients cancel through:

```http
DELETE /clients/me/appointments/:appointmentId
```

Only `PENDING` and `CONFIRMED` appointments can be cancelled by the client. Cancellation sets
`appointments.status = CANCELLED`, stamps `cancelled_at`, and frees the linked availability slot by
setting it back to `AVAILABLE` with `appointment_id = NULL`.

Completed, no-show, and already-cancelled appointments return `400 CANNOT_CANCEL`.

## Reviews

Clients review completed appointments through:

```http
POST /clients/me/reviews
```

Request body:

```json
{
  "appointmentId": "uuid",
  "rating": 5,
  "title": "Great experience",
  "comment": "Optional comment"
}
```

Rules:

- The appointment must belong to the authenticated client.
- The appointment must be `COMPLETED`.
- Only one review can exist per appointment.
- Review insertion and barber rating recalculation happen in the same transaction.

Public review lists hide client identity beyond first name and last initial.

## Web Pages

Client-facing pages now exist in `apps/web`:

- `/client`: hero search, quick filters, featured/mobile sections, and recently viewed barbers.
- `/client/barbers`: search, filters, sort, Danville/mobile presets, and verified/mobile toggles.
- `/client/barbers/:barberId`: tabbed public profile, mobile service, slots, reviews, and save action.
- `/client/barbers/:barberId/book`: service, appointment type, address, estimate, slot, and confirmation flow.
- `/client/appointments`: upcoming/past appointment list with status and contextual actions.
- `/client/appointments/:appointmentId`: status journey, map fallback, payment, cancellation, and review form.
- `/client/saved`: saved barber list.
- `/client/profile`: identity and client activity summary.
- `/client/profile/addresses`: saved-address management with Places suggestions, current-location autofill, map selection, and a draggable precise-location pin.
- `/client/design`: preset-driven Hair Design Studio with saved briefs and appointment attachment.

Phase 9 appointment details add correct service/travel/total pricing, both parties' notes, quick rebooking, a polished status journey, resilient static-map fallback, and 15-second live barber tracking while `ON_THE_WAY`.

Legacy unprefixed routes redirect to these canonical client routes. The barber dashboard remains under
`/barber/dashboard`.
