# Mobile app — working plan

Last updated: August 31, 2026

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
- Already on the ivory palette, and visually consistent with the web app

What it needed was not scaffolding but repair and reinforcement, which is what this round did.

## Verified this round

- **The app runs again.** It had been unbootable since the Clerk migration: `apps/mobile/.env.local`
  never received `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, so `ClerkProvider` threw at startup and the
  tree never mounted. Added the key; the welcome screen renders correctly at phone size.
- Metro bundles cleanly (2196 modules, ~8s). Typecheck, lint and tests are green.

## Done this round

- **Palette drift fixed and locked.** Mobile's `textSecondary` was still `#746B64` while the web
  had moved to `#6E665F` for contrast. `src/theme/colors.test.ts` now reads
  `apps/web/src/app/styles/ivory-tokens.css` and fails when the two disagree — verified by
  reverting the old value and watching it fail.
- **Text-safe tone added.** `goldText` (`#776242`) mirrors the web's `--ivory-champagne-text`.
  The palette now documents which tokens may carry words and which are decorative, and the test
  asserts every text-safe token clears 4.5:1 on all three surfaces.
- **Slot grid honours the new API fields.** The API now returns `isPast` and
  `status: AVAILABLE | BOOKED | PAST`. `SlotGrid` shows booked and passed times struck through,
  labelled, and unpressable instead of letting them look bookable — matching the web picker, and
  matching what the server will actually accept.

## Queue, roughly in order

1. **Contrast sweep of the screens.** `colors.gold` (2.9:1) and `colors.textMuted` (2.7:1) are used
   in ~52 places. Both are legitimate for icons, borders and fills, so this needs reading each call
   site, not a find-and-replace: where they carry text, move to `goldText` / `textSecondary`. The
   web equivalents were real readability bugs, so expect the same here.
2. **Run the booking flow end to end on a device or simulator.** This round verified rendering via
   Expo web. `xcrun simctl` fails on this machine (exit 72), so the iOS simulator was unavailable —
   worth resolving, because web cannot exercise maps, payments, notifications, or background
   location.
3. **Migrate `@clerk/clerk-expo` → `@clerk/expo`.** The current package logs a deprecation warning
   on every boot and points at Clerk core-3.
4. **`npx expo install --check`.** Expo reports 17 packages that may need aligning, and itself is
   57.0.15 vs 57.0.18.
5. **Confirm the mobile app reflects barber setup** the way the web now does — blocked days hidden,
   travel buffers excluded, day counts showing only bookable times.
6. **Hair Studio gating.** `EXPO_PUBLIC_ENABLE_HAIR_STUDIO=false` already exists. Check it matches
   the web's per-account gate (`publicMetadata.aiStudio`) rather than being purely build-time, so
   the same test accounts get access on both.

## Notes that will save time later

- **Expo web is the fast loop.** `pnpm --filter @barber-saas/mobile exec expo start --web` boots in
  seconds and is enough for layout, theme and navigation work. Native modules already have `.web`
  shims (`react-native-maps`, Stripe). It cannot validate anything native.
- **`.env.local` is gitignored**, so a missing key there is invisible in review — that is exactly
  how the Clerk key went missing. `.env.example` is the checklist; keep them in step.
- **`src/store/authStore.ts` is deliberate, not migration debris.** It mirrors Clerk's user for
  code outside React (background location tasks) and carries `/auth/me` fields Clerk does not hold.
  Clerk's hooks remain the source of truth for session state.
- The mobile app shares the Clerk instance with web and production. Seeding locally rewrites those
  accounts' Clerk metadata.
