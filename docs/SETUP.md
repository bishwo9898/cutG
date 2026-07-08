# Setup

## Prerequisites

- Node.js 18 or newer
- pnpm 8 or newer
- Docker Desktop or compatible Docker engine
- PostgreSQL CLI tools if you want to use `pnpm db:connect`

## Local Environment

```bash
pnpm install
cp .env.example .env
docker compose up -d
```

If `.env` already exists, do not overwrite it unless you intentionally want to reset local ports and secrets.

Verify containers:

```bash
docker compose ps
```

Run database setup:

```bash
pnpm db:migrate
pnpm db:seed
```

Start the API:

```bash
pnpm dev
```

Check health:

```bash
curl http://localhost:3000/health
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
- If `pnpm dev` fails with `EADDRINUSE` on port `3000`, another API server is already running. Stop that terminal with `Ctrl+C` or change `PORT` in `.env`.
- If migrations fail because extensions cannot be created, verify the connected user owns the local database.
- If `pnpm db:seed` fails, rerun it after `pnpm db:migrate`; the seed is designed to clear existing sample rows first.
