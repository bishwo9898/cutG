# Mobile app — working plan

Last updated: September 3, 2026 (round 5)

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
  password is _written_, so seeding succeeded and the accounts were simply unusable. Now
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
- **Booking was impossible: step 1 claimed the barber had published no services.** Same root cause
  as the badge — the step filtered on the truthiness of `isActive`, which the public endpoint omits,
  so every service was discarded. All four now appear and the flow proceeds.

Verified on the device afterwards: the date strip offers Sep 3, 4, 5 then jumps to Sep 8, correctly
skipping the weekend the barber does not work, and today's remaining times are bookable while the
API reports `isPast` false for them. That is the round-2 slot work confirmed outside of tests.

**Round 4 — booked an appointment end to end, and found the app could freeze permanently.**

The customer journey now completes on a real device: discover → barber → service → shop/mobile →
slot → review → confirm → appointment detail, with the row landing in the database.

Getting there surfaced the most serious bug so far. Confirm sat on "Confirming…" forever, and the
API log showed **no POST at all** — then nothing else either. The app had gone completely silent 29
minutes earlier, including its periodic notification poll.

The cause: `ApiClient` resolves auth headers with `await this.headers()`, which calls Clerk's
`getToken()`, and **nothing in the stack had a timeout**. When that token refresh stalled, the
request was never sent, no error was raised, and every later authenticated call queued behind the
same stalled promise. The UI showed a spinner with no way back short of killing the app.

`ApiClient` now takes an optional `timeoutMs`, which mobile sets to 20s. It deliberately races the
whole operation rather than passing an `AbortSignal` to `fetch`, because the stall happens _before_
fetch is reached — an abort signal alone would never have fired. Timeouts surface as
`ApiTimeoutError` and are translated into "That took too long. Check your connection and try
again." Off by default, so the web app is unaffected until it opts in.

Also confirmed on device: the slot grid re-fetches and marks newly-passed times as "Passed" while
you sit on the screen — 13:30 was bookable at 1:12pm and struck through by 1:57pm — and tapping a
passed slot does nothing, leaving Continue disabled.

**Round 5 — walked the barber portal, and found the booking clock was wrong.**

The barber side had never been opened on a device. Signed in as the seeded barber against a local
API and went through today, the booking detail, appointments, calendar, business, services and
profile. Nine finds, two of them serious.

- **Bookings were stored at the wrong time.** `scheduled_at` was selected as a bare timestamp,
  which node-pg parses into a JS `Date` in the _server's_ zone; writing that `Date` back into the
  `timestamptz` column re-encoded it as an instant. A 14:00 slot booked from a UTC-4 machine landed
  as `18:00+00`. On a UTC server the two conversions cancel and nothing looks wrong, which is why
  this survived — but the barber's calendar (which reads the slot) and Today list (which reads the
  appointment) were four hours apart on the same customer. The slot time is now carried as text so
  Postgres parses the wall clock once. `bookingTime.integration.test.ts` pins it, and pins its own
  `TZ` to `America/New_York` so a UTC CI box cannot hide the regression. The seed had the identical
  bug and is fixed the same way.
- **The booking screen showed a different time again**, this time by calling
  `new Date(scheduledAt).toLocaleTimeString()`. `scheduledAt` is a wall clock parked in the Z slot,
  not an instant, so formatting it locally shifts it. `lib/appointmentTime.ts` reads the components
  out of the string; `appointmentTime.test.ts` covers it in three zones. Timestamps that really are
  instants (created, confirmed, journey pings) still convert to local, correctly.
- **The customer's email rendered as `undefined`**, as a tappable `mailto:undefined` link. The
  detail query selected `u.first_name, u.last_name, u.phone` but not `u.email`, and the mapper does
  `String(row.email)`. The list query next to it had always selected it.
- **The map ate every vertical drag that started on it**, and it is a 220px band across the middle
  of the screen — so the barber could not scroll past it to Confirm, Decline, or the notes field.
  `scrollEnabled={false}` hands the pan back to the page.
- **The Appointments tab could get permanently stuck on a booking detail.** Opening a booking from
  Today pushes it into the _appointments_ tab's stack, so that tab then opened on the detail for
  the rest of the session and the list was unreachable except by hardware back. `popToTopOnBlur`
  on that tab, both portals.
- **The barber profile's name and bio were placeholders, not values.** The fields looked filled in
  but were empty, so editing the bio alone sent `businessName: ''` — which the API rejects, since
  the name is required. They now seed from the loaded profile, and an empty name is caught with a
  reason before the request goes out.
- **Blue links and a navigation arrow on things that do not navigate.** Links borrowed
  `statusOnTheWay`, which reads as an unstyled browser link in an ivory app; they now match the
  web's `.text-link` (ink text, champagne underline). `Badge` picks its glyph from its tone, so
  `tone="info"` put a navigation arrow on a service's duration, on a default address, and on an
  online-payments marker. `Badge` takes an `icon` override now and those three say what they mean.
- **The barber's own photo sat beside the customer's name** on every barber-side appointment card.
  `barberPhotoUrl` is only ever populated by the client service, so it was always undefined and the
  initials fallback hid it — it would have surfaced the moment the field was filled in.
- **A cold start flashed white** between the ivory splash and the ivory app, because the navigator
  paints its light-theme background behind the first screen. The root view is ivory now.

Not bugs, checked and cleared: Earnings and Subscription are absent from the Business hub because
they are behind `EXPO_PUBLIC_ENABLE_EARNINGS` / `_SUBSCRIPTIONS`, like the AI studio. The blank
grey map is the missing `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, not a layout fault.

## Queue, roughly in order

1. **The web has the same `scheduledAt` bug, in nine places.** `new Date(appointment.scheduledAt)`
   with a local format appears in `dashboard/page.tsx`, `dashboard/appointments/page.tsx` and its
   `[appointmentId]` detail, `appointments/[appointmentId]/page.tsx`, and `client-ui.tsx`. Vercel
   renders these in the _viewer's_ zone, so a customer outside the shop's zone is being told the
   wrong appointment time today. Mobile's `lib/appointmentTime.ts` is the shape of the fix.
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
- **Changing a shared package needs a rebuild before the device sees it.** Metro resolves
  `@barber-saas/api-client` through `main: dist/index.js`, not `src`, so edits are invisible on the
  phone until `pnpm --filter @barber-saas/api-client build`. Vitest is aliased to `src`, so tests
  can pass while the running app still has the old code.
- If the app hangs on a spinner and the API log goes quiet, the token refresh has stalled. Force
  stop and relaunch clears it. The 20s timeout now turns that into a visible error instead.
- **`scheduledAt` is a wall clock, not an instant.** The API emits the booked time in the `Z` slot
  (`2026-09-04T11:00:00.000Z` means 11am on the barber's clock), and `scheduledDate`/`startTime`
  are literal slices of that string. Never hand it to `new Date()` and format it locally — use
  `lib/appointmentTime.ts`. Genuine instants (`createdAt`, `confirmedAt`, journey pings) are
  ordinary UTC and should keep converting.
- **Running the API integration tests wipes the local dev database.** `resetTestDatabase()` is not
  scoped to a test schema, so a test run mid-walkthrough deletes whatever you were looking at on
  the phone. Reseed (`pnpm --filter @barber-saas/api db:seed`) before picking the walk back up.
- **Clerk takes the best part of a minute to initialise on the emulator.** A cold start sits on a
  blank screen far longer than feels reasonable. Wait 60s before concluding anything is wrong.
- `tsx watch` sometimes fails to free port 4000 when a source edit triggers a restart
  (`EADDRINUSE`, "Process didn't exit in 5s"). `lsof -ti tcp:4000 | xargs kill -9` and restart.
- **`pnpm format` rewrites the whole repository**, not the files you touched — it reformatted 24
  unrelated files in this round and they had to be reverted one by one. Format the files you
  changed (`pnpm exec prettier --write <paths>`) or check with `pnpm format:check`.
