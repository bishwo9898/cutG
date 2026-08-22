# cutG native private beta

`apps/mobile` is the shared iOS and Android app for cutG customers and barbers. It uses the same
Render API, Neon database, shared contracts, and secure payment infrastructure as the web app.

## Runtime and native stack

- Node.js 22.13 or newer
- Expo SDK 57 and React Native 0.86
- Expo Router, TanStack Query, Zustand, and Secure Store
- Native maps, notifications, image picking, secure card payment, and background location
- EAS development, internal preview, and reserved production profiles in `apps/mobile/eas.json`

Expo Go is useful for basic UI work, but it cannot validate the background journey workflow. Use a
development or internal EAS build on a physical phone for location, notification, directions, and
payment field tests.

## Environment

Copy `apps/mobile/.env.example` to `apps/mobile/.env`. A private-beta build needs only public,
restricted values:

```env
EXPO_PUBLIC_API_URL=https://YOUR-RENDER-SERVICE.onrender.com
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=restricted_mobile_key
EXPO_PUBLIC_EAS_PROJECT_ID=your_eas_project_id
EXPO_PUBLIC_ENABLE_HAIR_STUDIO=false
EXPO_PUBLIC_ENABLE_EARNINGS=false
EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS=false
```

Never put database, map server, payment secret, Cloudinary, email, or Expo access credentials in
the mobile env file. `EXPO_ACCESS_TOKEN` is an optional private API/Render secret used only by the
server when authenticated Expo push delivery is enabled.

For local physical-device work, `localhost` points to the phone. Set `EXPO_PUBLIC_API_URL` to the
computer's LAN address, for example `http://192.168.1.10:4000`.

## App workspaces

The welcome screen preserves a fixed Customer or Barber role through registration, verification,
sign-in, and recovery.

- Customer tabs: Discover, Appointments, Saved, Profile
- Barber tabs: Today, Appointments, Calendar, Business, Profile
- Both roles receive an authenticated notification inbox with unread state and safe appointment
  deep links.
- New barbers enter a setup checklist before the main workspace.
- Hair Studio, earnings, and subscriptions remain available in source but are hidden for the core
  beta unless their public feature flag is enabled.

The Ivory component layer uses 44-point minimum targets, readable pressed/disabled states, safe
areas, haptics, Dynamic Type-friendly text, and labeled semantic appointment colors.

## Customer lifecycle

Customers can use a saved address, typed address, or current location; filter nearby results by
category, distance, and price; review compact barber cards; and complete the guided appointment
flow. Appointment details use plain-language payment/status labels. During an active trip the app
polls every five seconds, keeps the last known position during brief failures, labels the feed
Live/Delayed/Reconnecting, and removes the precise marker after arrival.

## Barber lifecycle

Barbers can manage today's work, review full booking details, edit services, securely upload profile
photos, configure a precise service location, set weekly working hours, block dates, and inspect
available/booked/blocked slots. Booked slots include the customer and service summary with a direct
Review booking action.

Starting a mobile journey explains continuous sharing, requests precise foreground and background
permission, acquires an accurate initial point, starts the transactional API journey, and opens
native directions. The headless task sends approximately every ten seconds or ten metres, keeps
only the newest failed update, and stops on arrival, cancellation, completion, logout, or server
rejection.

## Notifications

Authenticated builds register one installation record per device through `/notifications/devices`.
The API keeps in-app alerts durable, paginates the inbox, enforces ownership, deduplicates delivery
per device, and disables invalid push tokens. Notification payloads contain only a known event type,
notification ID, and optional appointment ID; arbitrary client-provided links are never opened.

## Commands

```bash
pnpm --filter @barber-saas/mobile dev
pnpm --filter @barber-saas/mobile typecheck
pnpm --filter @barber-saas/mobile test
pnpm dlx expo-doctor@latest apps/mobile

# Sign in to EAS first, then choose one build profile:
pnpm dlx eas-cli build --profile development --platform ios
pnpm dlx eas-cli build --profile development --platform android
pnpm dlx eas-cli build --profile preview --platform all
```

Before creating a build, inspect the resolved public configuration:

```bash
pnpm --filter @barber-saas/mobile exec expo config --type public
```

For a release candidate, deploy the migration/API first, build the native app second, and then run
the two-device field test. Confirm background behavior while minimized and locked, arrival cleanup,
native directions, notification delivery/deep links, payment results, map/address resolution,
offline recovery, screen reader output, large text, contrast, and reduced motion. A user force-quit
can still suspend background work according to iOS or Android policy.
