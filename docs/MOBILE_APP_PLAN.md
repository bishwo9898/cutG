# Mobile app — working plan

Last updated: September 3, 2026

A running tracker for the `apps/mobile` work, so each round can pick up without re-deriving
context. `docs/MOBILE.md` stays the reference for the runtime, env, and build story; this file is
the state of play and the queue.

## Where the app actually stands

Worth saying plainly, because it is easy to assume otherwise: **the phone app is not a greenfield
project.** `apps/mobile` is a substantially built Expo app — 44 screens, 28 components, ~10k lines.

- Expo SDK 57, React Native 0.86, React 19, expo-router
- Both portals exist: customer (discover, barber profile, six-step booking, appointments, saved,
  profile, addresses, AI design) and barber (today, appointments, schedule, services, mobile
  service, payments, earnings, subscription, profile, setup)
- TanStack Query, Zustand, Clerk, Stripe, native maps, push notifications, background location
- On the ivory palette, visually consistent with the web app
- **Runs as a native Android development build**, verified on the emulator

## How to preview it — the three loops

Ranked by speed. Use the cheapest one that can answer the question in front of you.

**1. Expo web — seconds, no build.**

```bash
pnpm --filter @barber-saas/mobile exec expo start --web
```

Good for layout, theme, copy and navigation. Native modules resolve to the `.web` shims already in
the tree. Cannot exercise maps, Stripe, notifications, or background location.

**2. Android emulator with a development build — the real thing.**

```bash
~/Library/Android/sdk/emulator/emulator -avd Medium_Phone_API_35 &
pnpm --filter @barber-saas/mobile exec expo run:android
```

**Expo Go cannot be used for this project**: `PaymentProvider` wraps the whole tree in
`_layout.tsx` and imports `@stripe/stripe-react-native`, which is not in the Expo Go binary, so the
app crashes at startup. That is what `expo-dev-client` is for. The first Gradle build took **55
minutes** and saturated the machine (load average 34, the emulator's system process wedged) —
do not run other heavy work alongside it. Later builds reuse the daemon and are quick.

To point the app at a local API instead of production:

```bash
adb reverse tcp:4000 tcp:4000 && adb reverse tcp:8081 tcp:8081
# EXPO_PUBLIC_API_URL=http://localhost:4000 in apps/mobile/.env.local
```

**3. iOS simulator — one command away, and it needs your password.** `/Applications/Xcode.app` is
installed but `xcode-select` points at CommandLineTools, which is why `simctl` is missing:

```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

**Beyond the machine, before the stores.** `eas.json` already defines `development`, `preview` and
`production` profiles. `eas build --profile preview` produces an installable build shareable by
link, no store review. `eas update --channel preview` pushes JS-only changes in seconds. TestFlight
and Play internal testing come after; only production needs review.

`expo run:*` runs `expo prebuild`, which generates `android/` and `ios/`. Those are gitignored on
purpose — `app.config.js` is the source of truth for native config.

## Done so far

**Round 1 — got it running again, locked the palette.** The app had been unbootable since the Clerk
migration (`.env.local` never received `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`). `colors.test.ts` now
reads the web's `ivory-tokens.css` and fails when the palettes drift.

**Round 2 — contrast sweep, per-account AI gate, honest date strip.** 26 of 52 `gold`/`textMuted`
call sites moved to text-safe tones; AI Hair Studio gate brought in line with the web's per-account
flag; the booking date strip now offers only days with something genuinely bookable
(`lib/booking.ts`, tested).

**Round 3 — first real walkthrough on a device, and it paid for itself.** Signed in as the seeded
customer against a local API and walked the app. Four real bugs, none of which tests or static
analysis would have found:

- **Seed accounts could not sign in at all.** `SEED_TEST_PASSWORD` had been set to `password123`,
  which Clerk rejects at sign-in as a breached password. `skipPasswordChecks` only applies when the
  password is *written*, so seeding succeeded and the accounts were simply unusable. Now
  `CutgTest2026!`, consistent across the seed, the web field-test default, and nine docs.
- **The customer tab bar had 14 tabs.** `discover/`, `appointments/` and `profile/` had no
  `_layout.tsx`, so expo-router hoisted every nested route into the tab navigator — the bar filled
  with unnamed entries and broken icons, and pushing a screen swapped tabs instead of stacking.
  The barber side had the same gap in `business/` and `appointments/`. Five stack layouts added.
- **Every service showed an "Inactive" badge to customers.** The public services endpoint returns
  only active services and omits `isActive`, so a bare `!service.isActive` was true for all of them.
- **Barber photos rendered as blank boxes.** The API returns root-relative paths like
  `/images/barbers/barber-1.webp`, which mean nothing on a device, and the `!== null` check meant
  the placeholder never appeared — 260px of dead space on the profile, blank circles on cards.
  `lib/media.ts` now only passes through URIs a device can fetch.

## Queue, roughly in order

1. **Finish the walkthrough.** The booking flow (service → style → type → slot → confirm), the
   barber portal, appointments and profile have not been exercised on the device yet. The date
   strip and slot-grid work from round 2 in particular has only been verified by tests.
2. **Decide what to do about seeded images.** They live in `apps/web/public`, so the phone can
   never load them. Either serve them from the API or ship local placeholder assets — right now
   every seeded barber shows "No photo yet".
3. **Migrate `@clerk/clerk-expo` → `@clerk/expo`.** Deprecation warning on every boot.
4. **`npx expo install --check`.** 17 packages may need aligning; expo is 57.0.15 vs 57.0.19.
5. **Empty and error states** sweep, now that the date strip can legitimately be empty.
6. **Component tests.** There is no setup, which is why logic keeps being extracted to `lib/`.
   `@testing-library/react-native` would let the screens themselves be covered.

## Notes that will save time later

- **`.env.local` is gitignored**, so a missing key there is invisible in review — that is how the
  Clerk key went missing. `.env.example` is the checklist; keep them in step.
- **The mobile app points at production by default** (`EXPO_PUBLIC_API_URL=https://cutg-api.onrender.com`).
  Point it at a local API before testing anything that writes, or test bookings land in the live
  database.
- **`src/store/authStore.ts` is deliberate, not migration debris.** It mirrors Clerk's user for code
  outside React (background location) and carries `/auth/me` fields Clerk does not hold.
- The mobile app shares the Clerk instance with web and production. Seeding locally rewrites those
  accounts' Clerk metadata.
- A blank screen right after launch is usually just Clerk still initialising — `index.tsx` shows a
  spinner on the ivory background, which photographs as an empty screen. Give it a few seconds
  before assuming a crash.
- Only JDK 23 is installed. Gradle has been fine with it; if a native build starts failing on
  class-file versions, a JDK 17 is the usual fix.
