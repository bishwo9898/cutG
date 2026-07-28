# Two-person mobile barber field test

This test runs cutG on your computer and shares the web app through a temporary HTTPS Cloudflare
Quick Tunnel. No VPS, open router port, or public database is required. Keep the computer awake and
both terminal processes running for the entire test.

## Temporary accounts

These users are created by the development seed, are already verified, and do not send verification
email:

| Role   | Email                     | Password      |
| ------ | ------------------------- | ------------- |
| Client | `client.test@example.com` | `password123` |
| Barber | `barber.test@example.com` | `password123` |

The seed also creates a confirmed mobile appointment, a service destination, travel buffers, and an
enabled mobile-service configuration for the barber.

## Prepare a clean rehearsal

From the repository root:

```bash
pnpm field-test:prepare
```

This reruns migrations and recreates only the seeded test personas and their sample records. It does
not delete normal user accounts.

To exercise the full API workflow automatically before meeting your second tester, keep the API
running and use:

```bash
pnpm field-test:smoke
pnpm field-test:prepare
```

The smoke test intentionally completes the seeded appointment. The second preparation command puts
it back into the confirmed starting state for the manual rehearsal.

## Start the shared test URL

Stop any existing `pnpm dev` process first so ports 3000 and 4000 are available. Then run:

```bash
pnpm field-test
```

Wait for Wrangler to print an `https://...trycloudflare.com` URL. Open that same URL on both phones.
The test logins are prefilled while this field-test command is active.

1. On the barber phone, open **Barber sign in** and sign in.
2. On the client phone, open **Client sign in** and sign in.
3. On the barber phone, open **Appointments**, find the confirmed mobile appointment, and press
   **Start journey**.
4. Allow precise location. The app does not move the appointment to **On the way** unless it obtains
   a GPS position.
5. Keep the barber appointment page open during this foreground test. It shows whether the last GPS
   ping reached cutG.
6. On the client phone, open **Appointments** and the seeded appointment. The map and ETA refresh
   every five seconds while the barber is on the way.
7. Continue the barber workflow through **Arrived**, **Start service**, and **Complete**. Confirm each
   transition appears on the client phone.

Use a passenger to operate the barber phone while the vehicle is moving. Do not interact with the
phone while driving.

Stop the test with **Ctrl+C**. The public URL immediately stops working.

## What this validates

- Separate client and barber authentication
- Mobile appointment visibility and ownership
- Status transitions and timestamps
- Real device GPS capture
- Authenticated location-ping storage
- Client polling, moving map marker, distance, and ETA
- Arrived, in-progress, and completed workflow

The map can still track coordinates without a Google Maps server key. In that case cutG uses its
fallback distance estimate. A configured `GOOGLE_MAPS_API_KEY` improves driving ETA and reverse
geocoding, but Google Cloud does not replace the cutG API or database.

## Expected test limitations

- Cloudflare Quick Tunnels are temporary test infrastructure with no uptime guarantee.
- Browser location sharing is foreground-only. Keep the barber page visible and the phone awake.
- Stripe must remain in test mode; payment can be skipped if test keys are not configured.
- The tunnel URL is public while running. Use only the seeded accounts and synthetic appointment
  data.
- Native background tracking requires an Expo development build and background-location
  permissions; Expo Go cannot test that behavior. The foreground field test should pass before
  adding background tracking.
