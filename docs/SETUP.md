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

`make setup` is repeatable and does not overwrite an existing `.env`. It installs dependencies, starts PostgreSQL and Redis, waits for PostgreSQL, then runs migrations and seed data.

Open the applications:

- Frontend: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:4000](http://localhost:4000)
- API health: [http://localhost:4000/health](http://localhost:4000/health)
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

`make reset` deletes all local PostgreSQL and Redis data and asks for confirmation before continuing.

### Setup Without Make

The equivalent direct commands are:

```bash
pnpm install
test -f .env || cp .env.example .env
docker compose up -d postgres redis
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
```

Use separate restricted keys. Enable Geocoding and Distance Matrix for the server key, Places and native Maps SDKs for mobile, and Maps JavaScript for web. Restart API, web, and Expo after changing them. See `docs/MOBILE_BARBER.md` for restrictions and verification.

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
