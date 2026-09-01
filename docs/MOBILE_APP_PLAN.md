# Mobile app — working plan

Last updated: September 1, 2026

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

## How to preview it — the three loops

Ranked by speed. Use the cheapest one that can answer the question in front of you.

**1. Expo web — seconds, no build.**

```bash
pnpm --filter @barber-saas/mobile exec expo start --web
```

Renders the real screens in a browser at any phone size. Good for layout, theme, copy and
navigation. Native modules resolve to the `.web` shims already in the tree. It cannot exercise
maps, Stripe, notifications, or background location, and it is not a real device — do not sign off
on anything native here.

**2. Android emulator with a development build — minutes, full fidelity.**

```bash
~/Library/Android/sdk/emulator/emulator -avd Medium_Phone_API_35 &
pnpm --filter @barber-saas/mobile exec expo run:android
```

This is the real app with real native modules. **Expo Go cannot be used** for this project:
`PaymentProvider` wraps the whole tree in `_layout.tsx` and imports
`@stripe/stripe-react-native`, which is not in the Expo Go binary, so the app would crash at
startup. That is what `expo-dev-client` is in the dependencies for. The first build is slow
(Gradle downloads the SDK platform and build tools); later ones reuse the daemon and are quick.

**3. iOS simulator — currently unavailable on this machine.** `xcrun simctl` fails because
`xcode-select` points at CommandLineTools even though `/Applications/Xcode.app` is installed. One
command fixes it, and it needs your password so it has to be run by hand:

```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

Then `pnpm --filter @barber-saas/mobile exec expo run:ios`.

**Beyond the machine, before the stores.** `eas.json` already defines `development`, `preview` and
`production` profiles. `eas build --profile preview` produces an installable build (APK on Android,
internal distribution on iOS) that can be shared with testers by link — no store review. For JS-only
changes on top of an existing build, `eas update --channel preview` pushes in seconds. TestFlight
and Play internal testing come after that, and only production needs review.

Note `expo run:*` runs `expo prebuild`, which generates `android/` and `ios/`. Those are gitignored
on purpose: `app.config.js` is the source of truth for native config, and committing the generated
directories would fork it.

## Done so far

**Round 1 — got it running again, locked the palette.**

- The app had been unbootable since the Clerk migration: `apps/mobile/.env.local` never received
  `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, so `ClerkProvider` threw at startup. That file is
  gitignored, which is how it stayed invisible.
- `colors.test.ts` reads the web's `ivory-tokens.css` and fails when the palettes drift — added
  after finding mobile's secondary text a full step lighter than the web's.
- `SlotGrid` reads the new `isPast` / `status` fields.

**Round 2 — contrast sweep, per-account AI gate, honest date strip.**

- Went through all 52 `colors.gold` / `colors.textMuted` call sites individually. 26 were carrying
  text and moved to `goldText` / `textSecondary`; the rest are borders, slider tints, switch
  thumbs, Ionicons, placeholders and decorative glyphs, and stayed. Prices were the worst offenders
  — `h3` is 18px bold, just under the large-text threshold, so a champagne amount was failing even
  the relaxed 3:1 bar.
- AI Hair Studio now matches the web gate. It was build-time only, so an account flagged in Clerk
  got the feature on web but not on the phone. `hasAiStudioAccess` mirrors the web helper, plus a
  route guard on the design group for deep links.
- The booking date strip was a flat fourteen days from today, fetched a day at a time. It now
  fetches the window in one request and offers only days with something genuinely bookable. Logic
  extracted to `lib/booking.ts` with tests.

## Queue, roughly in order

1. **Finish the development build and walk both portals on the emulator.** Everything so far is
   verified by tests and Expo web. Maps, Stripe, notifications and background location have not
   been exercised on a device this round.
2. **Migrate `@clerk/clerk-expo` → `@clerk/expo`.** Deprecation warning on every boot, points at
   Clerk core-3.
3. **`npx expo install --check`.** Expo reports 17 packages that may need aligning, and itself is
   57.0.15 vs 57.0.18.
4. **Barber-side availability screen.** The web barber calendar now marks passed slots and excludes
   them from the "available" count; the mobile schedule screen has not had the same pass.
5. **Empty and error states.** Worth a sweep now that the date strip can legitimately be empty
   (a barber with nothing open in the window).
6. **Consider a component-test setup.** There is none, which is why booking logic was extracted to
   `lib/`. `@testing-library/react-native` would let the screens themselves be covered.

## Notes that will save time later

- **`.env.local` is gitignored**, so a missing key there is invisible in review — that is exactly
  how the Clerk key went missing. `.env.example` is the checklist; keep them in step.
- **`src/store/authStore.ts` is deliberate, not migration debris.** It mirrors Clerk's user for
  code outside React (background location tasks) and carries `/auth/me` fields Clerk does not hold.
- The mobile app shares the Clerk instance with web and production. Seeding locally rewrites those
  accounts' Clerk metadata.
- Only JDK 23 is installed. Gradle has been happy with it so far; if a native build starts failing
  on class-file versions, a JDK 17 is the usual fix.
