# Architecture

## Goals

This foundation optimizes for team onboarding, strict type contracts, database integrity, and incremental product phases without a rewrite.

## Monorepo

The repo uses pnpm workspaces:

- Apps can deploy independently.
- Shared contracts live in packages.
- Root scripts orchestrate common development tasks.

## API

The API is a small Express service with:

- Environment validation through Zod.
- A shared PostgreSQL connection pool.
- Structured JSON logging.
- Request logging middleware.
- Centralized error handling.
- Graceful shutdown for `SIGINT` and `SIGTERM`.

## Data Layer

Knex owns migrations and seeds. Application code should use parameterized queries or repository helpers. The schema favors database constraints for invariants that must hold across every code path.

## Type Safety

Zod schemas in `packages/shared-types` are the source of runtime validation and TypeScript inference. API handlers should parse untrusted input with schemas, then operate on inferred types.

## Scaling Path

- Add read replicas when marketplace discovery traffic grows.
- Partition `appointments` by scheduled date if historical volume becomes large.
- Move notification delivery workers into a separate app when async volume grows.
- Add Redis-backed queues and rate limiting before real-time and payment-heavy phases.
