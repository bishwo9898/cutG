# GPS Tracking

Last updated: July 13, 2026

Phase 9 adds foreground location sharing for mobile appointments. Tracking starts only while an owned appointment is `ON_THE_WAY`, stops when its status changes, and never requests background-location access.

## Lifecycle

1. The barber changes a confirmed mobile appointment to `ON_THE_WAY`.
2. Expo requests foreground location permission once and watches high-accuracy updates.
3. The native app sends a fire-and-forget ping every 15 seconds or 20 meters.
4. The API verifies barber ownership and an `ON_THE_WAY` or `ARRIVED` status.
5. The API retains only the latest 50 pings for that appointment.
6. The client polls the latest location every 15 seconds while `ON_THE_WAY`.
7. Remaining distance and ETA are recalculated against the appointment destination.
8. Polling and broadcasting stop after `ARRIVED`, `IN_PROGRESS`, cancellation, completion, or unmount.

Failed pings never interrupt the barber's journey UI. Permission denial shows one explanation and leaves status controls usable.

## API

```http
POST /barbers/me/appointments/:appointmentId/location
GET /clients/me/appointments/:appointmentId/barber-location
```

The POST body accepts latitude, longitude, optional accuracy in meters, heading from 0-360 degrees, and nonnegative speed in meters per second. Cross-owner appointment IDs return `404`; inactive tracking returns `400 TRACKING_NOT_ACTIVE`.

The client response is discriminated by `isTracking`. Active responses include the latest ping, ping age, barber first name, remaining miles, and ETA. Inactive and arrived responses contain a safe reason and no location history.

## Storage And Privacy

Migration `007_new_features.ts` creates `barber_location_pings` with coordinate checks and latest-ping indexes. Pings cascade with the appointment and are never exposed publicly. The API does not provide historical routes; clients receive only the latest location for their own appointment.

## Maps

The web appointment page uses an interactive two-pin map while tracking and a resilient static map otherwise. Static image errors immediately switch to an address card and Google Maps link, so a disabled Maps Static API never produces a broken image.

Enable Maps JavaScript, Places, Geocoding, and Maps Static APIs for the appropriately restricted web key. Native maps continue to use the mobile-restricted key.

## Verification

The seed includes a `CONFIRMED` mobile appointment for `barber.test@example.com` and
`client.test@example.com`; password: `CutgTest2026!`. Use the barber dashboard `Start journey` action
to transition into live tracking. Integration tests verify inactive-status rejection, ping recording,
ownership, latest-location retrieval, and ETA calculation without calling Google.
