# Clients

Phase 3 adds the client marketplace side of cutG: discovery, saved barbers, appointment booking,
cancellation, and reviews.

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

- `/`: marketplace homepage and featured barbers.
- `/barbers`: search and filters.
- `/barbers/:barberId`: public profile, services, slots, reviews, and save action.
- `/barbers/:barberId/book`: service, slot, and confirmation flow.
- `/appointments`: client appointment list.
- `/appointments/:appointmentId`: appointment detail, cancellation, and review form.
- `/saved`: saved barber list.

The barber dashboard remains under `/dashboard`.
