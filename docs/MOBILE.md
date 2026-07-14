# Mobile App

Phase 6 adds Mobile Barber settings, saved addresses, address selection during booking, travel estimates, native navigation, travel-fee breakdowns, and `ON_THE_WAY`/`ARRIVED` status UI. See `docs/MOBILE_BARBER.md` for the full operational contract.

Phase 5 turns `apps/mobile` into the Expo React Native app for cutG clients and barbers. It uses the existing API and shared workspace packages instead of duplicating backend contracts.

## Stack

- Expo SDK 51 with React Native 0.74
- Expo Router file-based routing under `apps/mobile/src/app`
- TanStack Query for server state
- Zustand plus `expo-secure-store` for auth state and JWT storage
- React Hook Form and Zod for auth form validation
- Stripe React Native for Payment Intent confirmation
- React Native Maps, Expo Location, Expo Image Picker, Expo Linking, and Expo Notifications scaffolding
- StyleSheet-based dark cutG design tokens in `apps/mobile/src/theme`

## Environment

Create a mobile env file from the example:

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Required local values:

```env
EXPO_PUBLIC_API_URL=http://localhost:4000
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
```

For iOS Simulator, `localhost` usually works. For Android Emulator, use `http://10.0.2.2:4000`. For a physical iPhone or Android device, `localhost` points to the device, not your Mac. Use your computer's LAN IP instead:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.x:4000
```

The API still reads the root `.env`. Stripe server keys belong there. The mobile app only needs the publishable key.

## Commands

```bash
pnpm --filter @barber-saas/mobile dev
pnpm --filter @barber-saas/mobile ios
pnpm --filter @barber-saas/mobile android
pnpm --filter @barber-saas/mobile typecheck
```

Standard local stack before opening the app:

```bash
make setup
make dev
pnpm --filter @barber-saas/mobile dev
```

`make dev` runs the API on port `4000` and the web app on port `3000`. Expo runs separately so Metro can control simulator/device sessions.

## Auth

The mobile auth store lives at `apps/mobile/src/store/authStore.ts`.

- Access tokens and refresh tokens are stored in `expo-secure-store`.
- The API wrapper injects `Authorization: Bearer <token>` automatically.
- A `401` triggers refresh-token exchange once, then retries the request.
- Failed refresh clears secure storage and returns the user to auth flow.

Seed credentials for local testing all use `password123`:

- `client1@example.com`
- `client2@example.com`
- `barber1@example.com`
- `barber2@example.com`
- `barber3@example.com`

## Client Flows

Implemented route groups under `apps/mobile/src/app/(client)`:

- Discover and search barbers
- Public barber profile with services, availability, reviews, save action, and Book Now
- Booking flow: select service, select slot, confirm, pay at shop or continue to Stripe
- Mobile booking address estimates with hard radius enforcement and advisory provider-failure fallback
- Synchronized native Places selection, current location, map taps, draggable pins, and exact coordinate persistence for client and barber addresses
- Foreground GPS broadcasting every 15 seconds while `ON_THE_WAY`, with silent network failure and automatic cleanup
- Client live-location polling, moving barber marker, remaining distance, and ETA
- Native placeholder Hair Design Studio and barber-visible style briefs
- Stripe card payment screen using `CardField` and `confirmPayment`
- Appointment list, detail, cancellation, payment status, and review submission
- Saved barbers
- Client profile editing and logout
- Polished active mobile-appointment timeline with 30-second polling and travel-state banners

## Barber Flows

Implemented route groups under `apps/mobile/src/app/(barber)`:

- Today dashboard with appointment stats and quick status transitions
- Schedule/slot view with edit/block-date sheet scaffold
- Appointment list with status filters and client search
- Appointment detail with status action, notes, payment status, and map placeholder
- Business hub with services, earnings, subscription, and Stripe status summaries
- Services list, create/edit/deactivate flow, and active toggles
- Earnings screen with period selector and Stripe payout CTA
- Subscription screen with tier comparison and Stripe Checkout launch
- Barber profile edit, image-picker URL capture, public preview, and logout

## Shared Mobile Foundation

| Path                                | Purpose                                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| `apps/mobile/src/components/ui`     | Buttons, inputs, cards, badges, avatar, ratings, skeletons, bottom sheet, empty states. |
| `apps/mobile/src/components/barber` | Barber cards, service cards, slot grids, reviews, appointment cards.                    |
| `apps/mobile/src/components/layout` | Screen wrapper, headers, keyboard wrapper.                                              |
| `apps/mobile/src/hooks`             | TanStack Query hooks for barbers, appointments, payments, and barber dashboard data.    |
| `apps/mobile/src/lib/apiClient.ts`  | Token-aware wrapper around `packages/api-client`.                                       |
| `apps/mobile/src/theme`             | cutG dark theme tokens.                                                                 |

## Stripe Payment Flow

`apps/mobile/src/app/(client)/discover/[barberId]/book/payment.tsx`:

1. Calls `POST /payments/create-intent` through the shared API client.
2. Receives `clientSecret` from the API.
3. Calls Stripe React Native `confirmPayment(clientSecret, { paymentMethodType: "Card" })`.
4. Navigates back to appointment detail on success.
5. Webhook processing remains the source of truth for final payment state.

Use Stripe test card `4242 4242 4242 4242` with any future expiry and CVC.

## Current Limitations

- Push notifications are scaffolded only; delivery comes in Phase 6.
- Real-time slot updates through WebSockets are not included yet.
- Photo upload to S3 is not implemented; mobile currently stores a URL or local picker URI.
- Schedule editing/block-date native controls are scaffolded and still need detailed form polish.
- App Store and Play Store build/release configuration is a later phase.
