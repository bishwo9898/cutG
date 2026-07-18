# cutG

Barber operations and client booking platform.

## Stack

- Node.js 20.9+
- pnpm workspaces
- Express.js with TypeScript strict mode
- PostgreSQL 14+ with Knex migrations
- Zod for runtime validation and inferred TypeScript types
- Docker Compose for local PostgreSQL, Redis, and private MinIO object storage
- Python FastAPI + Redis/RQ AI pipeline with mock and fal.ai FLUX Kontext providers

## Quick Start

```bash
make setup
make dev
```

`make setup` installs dependencies, creates `.env` only when it is missing, starts PostgreSQL,
Redis, and MinIO, then migrates and seeds the database. It also creates the Python AI environment.
`make dev` starts the API, web app, FastAPI service, and RQ worker together.

Open the frontend at [http://localhost:3000](http://localhost:3000). The API runs at [http://localhost:4000](http://localhost:4000). Start mobile separately with `pnpm --filter @barber-saas/mobile dev`.

Web entry points:

- Public landing: [http://localhost:3000](http://localhost:3000)
- Client marketplace: [http://localhost:3000/client](http://localhost:3000/client)
- Client sign in: [http://localhost:3000/client/login](http://localhost:3000/client/login)
- AI Hair Studio: [http://localhost:3000/client/design](http://localhost:3000/client/design)
- Barber dashboard: [http://localhost:3000/barber/dashboard](http://localhost:3000/barber/dashboard)
- Barber sign in: [http://localhost:3000/barber/login](http://localhost:3000/barber/login)

Health check:

```bash
curl http://localhost:4000/
curl http://localhost:4000/health
```

Expected response shape:

```json
{
  "status": "ok",
  "timestamp": "2026-07-07T00:00:00.000Z",
  "uptimeSeconds": 12,
  "database": {
    "status": "ok",
    "latencyMs": 4
  }
}
```

## Workspace Layout

- `apps/api`: Express API, database migrations, seeds, and runtime config.
- `apps/web`: Next.js frontend.
- `apps/mobile`: Expo React Native app for iOS and Android client/barber flows.
- `services/ai`: FastAPI validation, MediaPipe quality checks, RQ jobs, and fal.ai provider adapter.
- `packages/shared-types`: Zod schemas and inferred TypeScript types.
- `packages/shared-utils`: Shared validators and utility contracts.
- `docs`: Architecture, API, database, setup, and deployment notes.

## Core Commands

```bash
make help
make up
make down
make status
make logs
make dev
make test
```

The underlying pnpm commands remain available:

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm db:migrate
pnpm db:rollback
pnpm db:seed
pnpm db:connect
pnpm --filter @barber-saas/mobile dev
pnpm --filter @barber-saas/mobile ios
pnpm --filter @barber-saas/mobile android
```

For setup without Make:

```bash
pnpm install
test -f .env || cp .env.example .env
docker compose up -d postgres redis minio minio-init
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Seeded Data

The seed script creates 3 barber profiles, 12 client users, recurring availability, appointments, payments, reviews, subscriptions, two mobile-barber configurations, and two saved client addresses. All demo accounts use `password123`.

Google Maps keys are optional during local development because Phase 6 has deterministic mocks. Add `GOOGLE_MAPS_API_KEY`, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, and `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` before live Maps acceptance testing.

## Documentation

Start with [docs/FOUNDATION_TRACKER.md](docs/FOUNDATION_TRACKER.md) for the current build status, then read [docs/PORTALS.md](docs/PORTALS.md), [docs/SETUP.md](docs/SETUP.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATABASE.md](docs/DATABASE.md), [docs/MOBILE.md](docs/MOBILE.md), and [docs/MOBILE_BARBER.md](docs/MOBILE_BARBER.md).
