# Production runbook

## Runtime layout

The production system is four application processes plus managed infrastructure:

| Runtime                | Host                                        | Public URL                                                 |
| ---------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| Next.js web            | Vercel (`cut-g-web`)                        | `https://cut-g-web.vercel.app`                             |
| Express API            | Render web service (`cutg-api`)             | Yes                                                        |
| FastAPI AI service     | Render web service (`cutg-ai`)              | Yes for health checks; API traffic uses private networking |
| RQ generation worker   | Render background worker (`cutg-ai-worker`) | No                                                         |
| PostgreSQL             | Render Postgres                             | No public access                                           |
| Redis-compatible queue | Render Key Value (`cutg-redis`)             | No public access                                           |
| Image objects          | S3-compatible provider                      | Presigned HTTPS requests only                              |

The repository-root `render.yaml` defines the API, AI service, worker, PostgreSQL, and queue in
Virginia, close to Vercel's `iad1` region. Creating the Blueprint provisions paid `starter` compute
and a `basic-256mb` database; review the displayed monthly total before confirming it.

## 1. Provision the backend stack

In Render, create a Blueprint from the `main` branch of `github.com/bishwo9898/cutG`. Render reads
`render.yaml` and prompts for every secret marked `sync: false`.

Configure all prompted values with testing/sandbox credentials:

- `EMAIL_FROM`: a sender identity verified by SendGrid.
- `SENDGRID_API_KEY`: a restricted SendGrid key that can send mail.
- `GOOGLE_MAPS_API_KEY`: a server-side key restricted to the required Maps APIs.
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and
  `S3_FORCE_PATH_STYLE`: one private S3-compatible bucket.
- Stripe test-mode secret and publishable keys, webhook signing secret, and four test Price IDs.
- `FAL_KEY` can remain empty while `AI_PROVIDER=mock`. Add it to both AI services before changing
  the shared `AI_PROVIDER` value to `fal`.

The Blueprint generates the database, Redis connection, JWT secret, and shared internal AI secret.
It also runs compiled database migrations before every API deployment.

## 2. Configure object storage

Create a private bucket and allow browser `PUT` requests from:

- `https://cut-g-web.vercel.app`
- the final custom web domain, when added
- local development origins only if local browser testing needs the same bucket

Allow `GET`, `PUT`, and `HEAD` with the `Content-Type` request header. Do not make the bucket public;
the API produces short-lived presigned upload and download URLs.

## 3. Configure Stripe test mode

Use Stripe test-mode resources until the production workflow is signed off.

1. Create Basic and Premium monthly and annual Prices.
2. Add the four Price IDs to the API service.
3. Register `https://<api-host>/webhooks/stripe` as a webhook endpoint.
4. Subscribe the endpoint to the payment, Connect-account, checkout, invoice, and subscription
   events used by cutG.
5. Put the endpoint's signing secret in `STRIPE_WEBHOOK_SECRET`.

Production seeding never marks the barber as Stripe-ready with a fake account. To include an actual
Stripe test Connect account in the cohort, set `PRODUCTION_SEED_STRIPE_ACCOUNT_ID=acct_...` only for
the one-off seed command. Otherwise, onboard the seeded barber through the application before
testing online payments.

## 4. Create the production test cohort

The seed is intentionally blocked when `NODE_ENV=production`. After migrations succeed, open a
one-off shell for `cutg-api` and run:

```bash
ALLOW_PRODUCTION_TEST_SEED=true pnpm --dir apps/api db:seed:compiled
```

This command replaces only records owned by the known seed users or marked with seeded metadata. It
does not delete real customer accounts. Do not schedule it on every deployment because it resets the
test cohort's appointments and generated IDs.

Seed logins:

- Client: `client.test@example.com` / `CutgTest2026!`
- Barber: `barber.test@example.com` / `CutgTest2026!`

Change this shared test password before a public beta or restrict the test deployment with Vercel
Deployment Protection.

## 5. Connect Vercel

In the `cut-g-web` Vercel project, set only:

- `API_BASE_URL=https://<cutg-api-host>`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `NEXT_PUBLIC_MAP_STYLE_URL` when using a custom map style
- `NEXT_PUBLIC_MEDIAPIPE_FACE_MODEL_URL` when overriding the built-in model URL

Remove database, JWT, Redis, Stripe-secret, AWS-secret, SendGrid, FAL, and internal AI variables
from Vercel. They belong on the API/AI services and increase the blast radius of the frontend.
Redeploy the web project after changing `API_BASE_URL`; existing deployments retain old values.

## 6. Connect the mobile build

The mobile app does not use the Next.js proxy. Its release environment needs:

```dotenv
EXPO_PUBLIC_API_URL=https://<cutg-api-host>
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=...
```

Create a fresh Expo/EAS build after changing any `EXPO_PUBLIC_*` value because those values are
embedded at build time. Never use `localhost` in a physical-device build.

## 7. Release gates

Run the read-only smoke suite after the backend is healthy and Vercel has redeployed:

```bash
WEB_URL=https://cut-g-web.vercel.app \
API_URL=https://<cutg-api-host> \
pnpm verify:production
```

The suite checks web availability, API/database health, barber discovery, both seed logins, protected
client and barber routes, appointments, and Hair Studio configuration. It does not create bookings,
payments, uploads, or designs.

Before the first mobile-barber batch, manually verify in this order:

1. Client and barber sign in on two separate devices.
2. Location permission, address autocomplete, reverse geocoding, and travel estimate.
3. Shop booking and pay-later mobile booking.
4. Barber availability, appointment confirmation, start-journey, and location broadcasting.
5. Client live tracking and appointment completion.
6. Stripe test payment, webhook receipt, refund, and Connect payout visibility.
7. Hair capture upload, validation, queued generation, callback, result display, retry, and deletion.
8. Registration, verification email, forgot-password email, and password reset.

Do not move to Stripe live mode or real customer appointments until every gate passes and production
logs contain no unexpected `5xx`, failed webhook signatures, stalled AI jobs, or database errors.
