# Setup

## Prerequisites

- Node.js 20.9 or newer
- pnpm 9 or newer
- Docker Desktop or compatible Docker engine
- PostgreSQL CLI tools if you want to use `pnpm db:connect`

## Local Environment

The standard first-time setup is:

```bash
make setup
make dev
```

`make setup` is repeatable and does not overwrite an existing `.env`. It installs dependencies,
starts PostgreSQL, Redis, and private MinIO object storage, waits for PostgreSQL, then runs migrations
and seed data.

Open the applications:

- Frontend: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:4000](http://localhost:4000)
- API health: [http://localhost:4000/health](http://localhost:4000/health)
- MinIO console: [http://localhost:9001](http://localhost:9001)
- Mobile Expo app: `pnpm --filter @barber-saas/mobile dev`

Useful Make commands:

```bash
make help
make status
make logs
make restart
make down
make test
```

`make reset` deletes all local PostgreSQL, Redis, and MinIO data and asks for confirmation before
continuing.

### Setup Without Make

The equivalent direct commands are:

```bash
pnpm install
test -f .env || cp .env.example .env
docker compose up -d postgres redis minio minio-init
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Verify the containers and API:

```bash
docker compose ps
curl http://localhost:4000/health
```

## Mobile Setup

Create the mobile env file when working on iOS/Android:

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Set `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` to your Stripe publishable key. Use `EXPO_PUBLIC_API_URL=http://localhost:4000` for iOS Simulator. Use `http://10.0.2.2:4000` for Android Emulator. For a physical device, replace `localhost` with your computer's LAN IP, for example `http://192.168.1.x:4000`.

### Google Maps

Phase 6 runs with deterministic development/test map behavior until keys are added:

```env
GOOGLE_MAPS_API_KEY=
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_MAP_STYLE_URL=
```

Enable Geocoding and Distance Matrix for the server key when you want Google-backed address labels
and driving estimates. Local booking remains usable without Google because exact pin coordinates and
deterministic travel estimates are used as fallbacks. The client and barber web portals use
MapLibre and do not need a public Google browser key. `NEXT_PUBLIC_MAP_STYLE_URL` is optional and
defaults to a dark CARTO style. Restart API, web, and Expo after changing map values.

The root `.env.local` and `.env` files are loaded by API, web, and Expo. `.env.local` takes precedence. Do not reuse a website-referrer key for server-side Geocoding or Places REST requests: Google rejects those requests even when Maps JavaScript works.

Browser geolocation is optional for client booking setup and required only for true live barber
tracking. If a client denies location, the booking map centers near the barber service area and the
client can place the exact pin manually. If a barber denies location while starting a journey,
appointment status updates still work, but the client will not receive live GPS movement.

### AI Hair Studio

Local development is free and deterministic:

```env
ENABLE_AI_FEATURES=true
AI_PROVIDER=mock
AI_STRICT_CAPTURE_VALIDATION=false
REDIS_URL=redis://localhost:6380
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=cutg-ai-local
S3_ACCESS_KEY_ID=cutg-local
S3_SECRET_ACCESS_KEY=cutg-local-secret
```

`make ai-install` creates `services/ai/.venv`, installs pinned dependencies, and downloads the
official MediaPipe detector model. `pnpm dev` and `make dev` start API, web, FastAPI, and the Python
RQ worker. Local development uses RQ's spawn worker so native image libraries run safely on macOS.
`make setup` also creates the private MinIO bucket. Web and mobile use a photo picker for one
front-facing headshot, upload it through a private presigned URL, and rely on server-side MediaPipe
quality analysis before generation. With `AI_STRICT_CAPTURE_VALIDATION=false`, development accepts
side profiles and low-quality but readable images while still recording their metrics. Set it to
`true` when capture guidance should block unsuitable images. No native camera development build is
required.

For production fal.ai processing:

```env
AI_PROVIDER=fal
FAL_KEY=replace_with_server_key
AI_GENERATION_MODEL=fal-ai/flux-pro/kontext
AI_STRICT_CAPTURE_VALIDATION=false
AI_INTERNAL_SECRET=replace_with_at_least_32_random_characters
```

Keep `FAL_KEY` server-only. Configure private production S3 credentials, restrict worker network
access, and set `AI_MONTHLY_BUDGET_CENTS` to a non-zero safety ceiling.
`AI_GENERATION_DAILY_LIMIT` defaults to `5`; `AI_SCAN_RETENTION_HOURS` defaults to `24`.

The mock end-to-end verifier is safe by default and rejects a non-mock service configuration:

```bash
pnpm verify:hair-studio
```

With API and worker services explicitly configured for `AI_PROVIDER=fal` and a funded server-only
`FAL_KEY`, opt in to one real image request with
`HAIR_STUDIO_REAL_PROVIDER=1 pnpm verify:hair-studio`. Provider errors are reported with the exact
failed stage and are never retried automatically.

### Stripe Card Checkout

Set `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET`. Then complete Stripe
Connect onboarding for the barber from the barber payment dashboard. Card payment remains hidden
for barbers without charges enabled; cash remains available.

For local UI testing, seed data creates exactly one fake, Danville-based, payment-ready PREMIUM
barber: `barber.test@example.com` / `password123`. The matching client is
`client.test@example.com` / `password123`. The barber's local-only Stripe Connect flags are only a
development convenience. Real destination charges still require real Stripe credentials, Connect
onboarding, and webhook delivery.

For local webhook synchronization:

```bash
stripe listen --forward-to localhost:4000/webhooks/stripe
```

Copy the emitted `whsec_...` into `.env` and restart the API. See `docs/PAYMENTS.md` for the full
test-card workflow.

Run Expo separately from `make dev`:

```bash
pnpm --filter @barber-saas/mobile dev
pnpm --filter @barber-saas/mobile ios
pnpm --filter @barber-saas/mobile android
```

## Database Access

```bash
pnpm db:connect
```

Useful checks:

```sql
SELECT COUNT(*) FROM users;
SELECT status, COUNT(*) FROM appointments GROUP BY status;
```

## Troubleshooting

- This project defaults PostgreSQL to host port `55433` because many Macs already have local PostgreSQL on `5432`.
- If port `55433` is already in use, set `POSTGRES_HOST_PORT` to another free port and update `DATABASE_URL` to match it.
- This project defaults Redis to host port `6380` because local Redis commonly uses `6379`.
- If Redis port `6380` is already in use, set `REDIS_HOST_PORT` to another free port.
- The web application uses port `3000`; the API uses port `4000`. Expo/Metro will choose its own development port and show a QR code.
- If `pnpm dev` fails with `EADDRINUSE`, inspect the port with `lsof -nP -iTCP:3000 -sTCP:LISTEN` or `lsof -nP -iTCP:4000 -sTCP:LISTEN`, then stop the stale process.
- If Docker reports a port conflict, update the corresponding host port in `.env`; keep `DATABASE_URL` synchronized with `POSTGRES_HOST_PORT`.
- If migrations fail because extensions cannot be created, verify the connected user owns the local database.
- If `pnpm db:seed` fails, rerun it after `pnpm db:migrate`; the seed is designed to clear existing sample rows first.
