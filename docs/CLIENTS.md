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
  "paymentMethod": "CASH",
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

Mobile bookings add one pin-confirmation step before slot selection:

- The browser requests foreground location once and centers a MapLibre map near the client.
- The client drags or taps the destination pin to select the exact driveway, entrance, or arrival point.
- Saved addresses are optional recenter shortcuts and are never selected automatically.
- If location permission is denied, the map starts near the barber's approximate service area and remains fully usable.
- `POST /clients/me/locations/reverse-geocode` resolves the selected coordinates through the server key. The exact coordinates remain authoritative for navigation.
- The web flow estimates distance, travel minutes, fee, travel-ready slots, barber departure timing, and projected finish time before confirmation.
- Saved addresses can also be managed separately from `/client/profile/addresses`.
- Pin changes debounce travel estimation. `OUTSIDE_SERVICE_AREA` blocks progress.
- Google travel failures fall back to the deterministic local distance model, matching no-key local
  development behavior.

`paymentMethod` is `CASH` or `CARD`. Cash is always available. Card is offered only when Stripe is configured and the barber has completed Connect onboarding. Card appointments are reserved first and then paid through Stripe Elements; a failed payment remains retryable from appointment detail.

## Cancellation

Clients cancel through:

```http
DELETE /clients/me/appointments/:appointmentId
```

Only `PENDING` and `CONFIRMED` appointments can be cancelled by the client. Cancellation sets
`appointments.status = CANCELLED`, stamps `cancelled_at`, and frees the linked availability slot by
setting it back to `AVAILABLE` with `appointment_id = NULL`.

Completed, no-show, and already-cancelled appointments return `400 CANNOT_CANCEL`.
Cancelling a pending card appointment also cancels its pending Payment Intent. A succeeded card
payment must use the refund action, which refunds and cancels the appointment together.

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
- `/client/barbers/:barberId/book`: progressive service, type, pin, time, review, and Stripe/cash checkout flow.
- `/client/appointments`: upcoming/past appointment list with status and contextual actions.
- `/client/appointments/:appointmentId`: status journey, map fallback, payment, cancellation, and review form.
- `/client/saved`: saved barber list.
- `/client/profile`: identity and client activity summary.
- `/client/profile/addresses`: saved-address management through the same MapLibre pin-first location workflow.
- `/client/design`: preset-driven Hair Design Studio with saved briefs and appointment attachment.

Appointment details include service/travel/total pricing, payment method, Stripe retry/refund actions,
both parties' notes, quick rebooking, MapLibre destination maps, and 15-second live barber tracking
while `ON_THE_WAY`.

Legacy unprefixed routes redirect to these canonical client routes. The barber dashboard remains under
`/barber/dashboard`.
