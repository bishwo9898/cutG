# Deployment

cutG is a monorepo with three different runtime profiles. Deploy the Next.js web app to Vercel,
and deploy the long-running API and AI worker stack to a container platform during testing.

| Component     | Recommended test host                              | Reason                                                                       |
| ------------- | -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `apps/web`    | Vercel                                             | Native Next.js support, route handlers, middleware, and ISR                  |
| `apps/api`    | Railway, Render, Fly.io, or another container host | Express server, PostgreSQL pool, graceful shutdown, and periodic maintenance |
| `services/ai` | A container/worker host                            | FastAPI, Redis/RQ workers, model files, and long-running background jobs     |

The API and AI services are not currently Vercel Function targets. In particular, the API starts a
persistent HTTP server and maintenance timer, while AI generation relies on a persistent RQ worker.
Moving either one to Vercel would require an intentional serverless refactor, not only build settings.

## Vercel web project

Import the repository as a new Vercel project and use these settings:

- **Framework Preset:** Next.js
- **Root Directory:** `apps/web`
- **Include source files outside of the Root Directory:** enabled
- **Build Command:** leave at the detected `pnpm build`
- **Install Command:** leave at the detected `pnpm install`
- **Output Directory:** leave at the Next.js default
- **Node.js:** use a version supported by the root `package.json` (`>=20.9.0`)

The outside-source option is required because the web app imports the workspace packages in
`packages/api-client` and `packages/shared-types`. The checked-in `apps/web/vercel.json` pins the
Next.js framework preset and enables Fluid compute without replacing Vercel's framework defaults.

Do not configure the Vercel project at the repository root: the root `build` script intentionally
builds every JavaScript workspace, including the API and mobile app.

## Vercel environment variables

Configure variables separately for Preview and Production. The web deployment needs:

| Variable                               | Required        | Exposure    | Purpose                                                           |
| -------------------------------------- | --------------- | ----------- | ----------------------------------------------------------------- |
| `API_BASE_URL`                         | Yes             | Server only | Public HTTPS origin of the deployed API, without a trailing slash |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`      | For Google Maps | Browser     | Restrict this key by Vercel/custom domains in Google Cloud        |
| `NEXT_PUBLIC_MAP_STYLE_URL`            | Optional        | Browser     | MapLibre style URL; the app has a public fallback                 |
| `NEXT_PUBLIC_MEDIAPIPE_FACE_MODEL_URL` | Optional        | Browser     | Face landmark model URL; the app has a public fallback            |

Example:

```dotenv
API_BASE_URL=https://api-testing.example.com
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_MAP_STYLE_URL=
NEXT_PUBLIC_MEDIAPIPE_FACE_MODEL_URL=https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
```

Never add API credentials, database URLs, JWT secrets, Stripe secret keys, or AI provider keys with
a `NEXT_PUBLIC_` prefix. Vercel embeds those variables in browser JavaScript.

## API environment and cross-service URLs

The API container must use production values for at least:

- `NODE_ENV=production`
- `DATABASE_URL` (managed PostgreSQL with TLS as required by the provider)
- `DATABASE_POOL_MIN` and `DATABASE_POOL_MAX`
- `JWT_SECRET` (at least 32 random characters)
- `WEB_APP_URL` (the exact Vercel production origin, with no trailing slash)
- `AI_SERVICE_URL`, `AI_INTERNAL_SECRET`, and `REDIS_URL` when AI is enabled
- Stripe and S3-compatible object-storage values when those features are enabled

For Preview deployments, the browser talks to the same-origin Next.js backend proxy, which then
uses `API_BASE_URL`. Direct browser-to-API requests still require the API's `WEB_APP_URL` CORS
allowlist to match the calling origin.

## Release order

1. Provision managed PostgreSQL, Redis, and S3-compatible object storage.
2. Deploy the AI service and its RQ worker, then record its internal/public HTTPS URL.
3. Configure the API environment and run database migrations once as a release step.
4. Deploy the API container and verify `GET /health` returns `200` with a healthy database.
5. Set `API_BASE_URL` in Vercel for Preview and Production.
6. Deploy the Vercel web project and smoke-test login, registration, booking, payment callbacks, and
   direct-to-object-storage image uploads.

Run migrations before starting API instances with the new application version:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
```

## Pre-deploy verification

From the repository root, run the same frontend build used by Vercel:

```bash
pnpm install --frozen-lockfile
pnpm --filter @barber-saas/web build
pnpm --filter @barber-saas/web test
```

For a full release candidate, also run:

```bash
pnpm typecheck
pnpm test
```

The image capture flow uploads directly to presigned object-storage URLs. Keep it that way: Vercel
Functions have request and response payload limits, so large images should not be proxied through a
Next.js route handler.

## Operational checks

- Confirm `GET /health` reports a healthy database before deploying the web app.
- Register the API's `/webhooks/stripe` URL in Stripe and set the matching webhook secret.
- Use HTTPS URLs for every cross-service production value.
- Keep Preview and Production secrets separate.
- Ship API and AI logs to the hosting provider's log collector.
- Retain enough API shutdown time for in-flight requests and database connections to close.
