# Barber SaaS

Production-ready Phase 0 foundation for a barber operations and client booking SaaS.

## Stack

- Node.js 18+
- pnpm workspaces
- Express.js with TypeScript strict mode
- PostgreSQL 14+ with Knex migrations
- Zod for runtime validation and inferred TypeScript types
- Docker Compose for local PostgreSQL and Redis

## Quick Start

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

If `.env` already exists, do not overwrite it unless you intentionally want to reset local ports and secrets.

Health check:

```bash
curl http://localhost:3000/
curl http://localhost:3000/health
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
- `apps/web`: Next.js placeholder for Phase 4.
- `apps/mobile`: React Native placeholder for Phase 7.
- `packages/shared-types`: Zod schemas and inferred TypeScript types.
- `packages/shared-utils`: Shared validators and utility contracts.
- `docs`: Architecture, API, database, setup, and deployment notes.

## Core Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm db:migrate
pnpm db:rollback
pnpm db:seed
pnpm db:connect
```

## Seeded Data

The seed script creates 3 barber profiles, 12 client users, services, 45 availability slots, 20 appointments, 10 payments, 8 reviews, subscriptions, and notifications.

## Documentation

Start with [docs/FOUNDATION_TRACKER.md](docs/FOUNDATION_TRACKER.md) for the current build status, then read [docs/SETUP.md](docs/SETUP.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [docs/DATABASE.md](docs/DATABASE.md).
# cutG
