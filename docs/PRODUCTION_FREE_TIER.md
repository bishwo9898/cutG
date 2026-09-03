# Zero-cost production testing deployment

This deployment is intentionally a testing environment, not a high-availability production stack.
It hosts only the services used by the current non-AI product flows.

## Architecture and expected cost

| Component           | Provider and plan             | Purpose                                       | Expected testing cost              |
| ------------------- | ----------------------------- | --------------------------------------------- | ---------------------------------- |
| Web                 | Existing Vercel Hobby project | Next.js UI and same-origin API proxy          | $0                                 |
| API                 | Render Free web service       | Express API and automatic Knex migrations     | $0                                 |
| Database            | Neon Free                     | Durable PostgreSQL                            | $0 within limits                   |
| Images              | Cloudinary Free               | Profile, service, portfolio, and banner media | $0 within 25 monthly credits       |
| Transactional email | Gmail SMTP via Nodemailer     | Verification and password-reset test messages | $0 for a small private test cohort |
| Payments            | Stripe test mode              | Payment and Connect testing                   | $0; no real charges                |
| Maps                | Google Maps Platform          | Address, geocoding, and maps                  | Usage-based; keep quotas low       |

AI generation is disabled. Redis, the FastAPI service, the RQ worker, fal.ai, and private S3/R2
storage are therefore not deployed. Re-enable them only when AI testing is scheduled and a budget
has been approved.

## 1. Prepare accounts

You need accounts for GitHub, Vercel, Render, Neon, Cloudinary, Gmail, Stripe, and optionally Google
Cloud. Keep every provider in test/free mode and configure provider billing alerts or hard quotas
where available.

Never paste secrets into Git, chat, screenshots, or the Vercel public environment-variable prefix.
Production secrets belong only in provider dashboards.

## 2. Create the Neon database

1. Create a Neon project on the Free plan.
2. Choose `AWS US East (N. Virginia)` when available so it is close to the Render `virginia`
   service.
3. Name the database `cutg`.
4. In **Connect**, enable **Connection pooling** and copy the pooled connection string. Its hostname
   contains `-pooler`, and the URL should retain `sslmode=require`.
5. Save this URL for Render as `DATABASE_URL`. Do not add it to Vercel or Git.

Migrations run automatically every time the API container starts. They are safe to rerun and the
API will not accept traffic until they succeed.

### Optional one-time demo data

The application works with an empty migrated database, but discovery screens will be empty. For a
guided test, seed the known demo users exactly once from a trusted local terminal:

```bash
NODE_ENV=production \
ALLOW_PRODUCTION_TEST_SEED=true \
DATABASE_URL='paste-the-neon-pooled-url-here' \
pnpm --filter @barber-saas/api db:seed
```

This creates demo accounts whose password is `CutgTest2026!`. Treat them as public test fixtures,
never as real accounts. Running the seed again replaces only seeded fixture data and can erase
appointments created against those fixtures. Do not leave `ALLOW_PRODUCTION_TEST_SEED` set on
Render.

## 3. Configure Cloudinary

1. Create or use a Cloudinary Free product environment.
2. In **API Keys**, copy the complete environment URL in this shape:
   `cloudinary://API_KEY:API_SECRET@CLOUD_NAME`.
3. Save it for Render as `CLOUDINARY_URL`.
4. Keep `CLOUDINARY_FOLDER=cutg-production`.

Cloudinary is required for production image uploads. Without it, the rest of the app still starts,
but profile, service, portfolio, and banner uploads return a configuration error. The API never
stores uploads on Render's ephemeral filesystem.

## 4. Configure temporary transactional email with Gmail SMTP

This zero-cost testing configuration uses Nodemailer with a dedicated Gmail account. It is suitable
only for a small private test cohort; use a transactional provider with a verified domain before a
public beta.

1. Enable 2-Step Verification on the dedicated Google account.
2. Create a 16-character Google App Password named `cutG Render`.
3. Configure Render with `EMAIL_PROVIDER=smtp`, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, and
   `SMTP_SECURE=true`.
4. Set both `SMTP_USER` and `EMAIL_FROM` to the Gmail address.
5. Save the App Password as `SMTP_PASSWORD`. Never use the normal Google account password.

Registration and password reset require working email. `EMAIL_PROVIDER=log` is not a production
fallback because production deliberately does not write security codes to logs. Gmail may throttle
or block automated server traffic, so replace this transport before inviting real customers.

## 5. Configure Stripe test mode

In Stripe, turn on **Test mode** before copying any values.

1. Copy the test secret key (`sk_test_...`) to `STRIPE_SECRET_KEY`.
2. Copy the test publishable key (`pk_test_...`) to `STRIPE_PUBLISHABLE_KEY`.
3. Create four recurring test Prices and save their `price_...` IDs as:
   `STRIPE_PRICE_BASIC_MONTHLY`, `STRIPE_PRICE_BASIC_ANNUAL`,
   `STRIPE_PRICE_PREMIUM_MONTHLY`, and `STRIPE_PRICE_PREMIUM_ANNUAL`.
4. The API derives web checkout return URLs from `WEB_APP_URL`; do not create a second public URL
   variable in Vercel.
5. After Render gives you the API URL, create a Stripe webhook endpoint at
   `https://YOUR-RENDER-SERVICE.onrender.com/webhooks/stripe`.
6. Subscribe it to `payment_intent.succeeded`, `payment_intent.payment_failed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`, and
   `account.updated`. Copy its `whsec_...` signing secret to `STRIPE_WEBHOOK_SECRET` on Render.

Stripe test mode does not move real money. Do not use `sk_live_`, `pk_live_`, or live Price IDs in
this environment.

## 6. Optional Google Maps configuration

Maps are not strictly required for basic auth, profiles, and shop bookings. Without a server key,
the API uses deterministic fallback estimates where supported.

If testing live maps:

1. Use separate restricted browser and server keys.
2. Restrict the browser key by HTTP referrer to the exact Vercel domains and enable only browser
   map/places APIs used by the UI.
3. Restrict the server key to the minimum geocoding/routes APIs used by the backend.
4. Put the server key in Render as `GOOGLE_MAPS_API_KEY`.
5. Put the browser key in Vercel as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
6. Set a small daily quota and a budget alert in Google Cloud. A budget alert is not a hard cap.

## 7. Deploy the API on Render

1. Push this repository and the updated `render.yaml` to the `main` branch on GitHub.
2. In Render, choose **New > Blueprint** and connect `bishwo9898/cutG`.
3. Confirm that the Blueprint creates only one resource: `cutg-api`, plan **Free**. If it proposes
   PostgreSQL, Key Value, AI, or worker resources, cancel and confirm Render is reading the latest
   commit.
4. Enter every prompted environment variable. Use the exact Vercel production origin (HTTPS and no
   trailing slash) for `WEB_APP_URL`.
5. Deploy and watch the logs. A successful boot first reports completed Knex migrations and then
   `cutG API started`.
6. Open `https://YOUR-RENDER-SERVICE.onrender.com/health`. Expect HTTP 200 and
   `database.status` equal to `ok`.

Render generates `JWT_SECRET`; do not replace it after users begin testing, because changing it
signs everyone out. Render Free sleeps after 15 idle minutes, so the first request after a quiet
period can take about one minute. That is the principal compromise of the $0 API plan.

## 8. Connect the existing Vercel frontend

In the Vercel project, add these variables to **Production** (and Preview only if desired):

```text
API_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-restricted-browser-key-or-empty
NEXT_PUBLIC_MAP_STYLE_URL=your-map-style-url-or-empty
```

`API_BASE_URL` is server-only. Never rename it to `NEXT_PUBLIC_API_BASE_URL`; browser requests are
supposed to go through the Next.js `/api/backend/*` proxy so tokens remain in HTTP-only cookies.

Redeploy the Vercel production deployment after saving variables. Environment changes do not alter
an already-built deployment.

## 9. Verify the deployment

If demo data was seeded, run:

```bash
WEB_URL='https://YOUR-VERCEL-DOMAIN' \
API_URL='https://YOUR-RENDER-SERVICE.onrender.com' \
pnpm verify:production
```

The verifier allows 90 seconds for a sleeping free API to wake. Then manually test:

1. Register a new client and receive/submit the Gmail-delivered verification code.
2. Register a barber, edit the profile, availability, and services, and upload an image.
3. Discover that barber as a client and create an appointment.
4. Test password reset email.
5. Exercise Stripe only with official test cards and confirm the webhook receives test events.
6. Confirm API logs contain no tokens, credentials, verification codes, or uploaded image bodies.

## 10. Operating guardrails

- Use only synthetic people, images, addresses, and payment data during this phase.
- Monitor Neon storage/compute, Render free hours/bandwidth/build minutes, Cloudinary credits,
  Gmail delivery/security alerts, Vercel usage, and Google Maps quotas weekly.
- Neon is the system of record. Export a logical backup before destructive schema or seed work.
- Do not rely on Render local files; they disappear on sleep, restart, and deploy.
- If API cold starts disrupt testing, temporarily keep the service warm only during scheduled test
  sessions, or upgrade the API. Do not add AI services merely to avoid a cold start.
- The first paid upgrade should be the API instance. Add AI/Redis/object storage only after the core
  booking flow is stable and there is an explicit AI budget.
