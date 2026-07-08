# Deployment

## Build

```bash
pnpm install --frozen-lockfile
pnpm build
```

## Environment

Production must provide:

- `NODE_ENV=production`
- `DATABASE_URL`
- `DATABASE_POOL_MIN`
- `DATABASE_POOL_MAX`
- `JWT_SECRET`
- `WEB_APP_URL`
- Provider secrets for Stripe, AWS, and email when those phases launch.

## Database Migrations

Run migrations as a release step before starting new application containers:

```bash
pnpm db:migrate
```

Use `pnpm db:rollback` only for a confirmed failed release window. Prefer forward-fix migrations after code has reached shared environments.

## Containers

The API Dockerfile builds the API and shared packages. In production, use managed PostgreSQL and Redis instead of the local Compose services.

## Operational Checks

- `GET /health` should return `200` with `database.status = "ok"`.
- Logs are structured JSON and should be shipped to the platform log collector.
- Configure graceful termination long enough for in-flight API requests to finish.
