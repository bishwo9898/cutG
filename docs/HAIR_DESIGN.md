# AI Hair Studio

Last updated: July 18, 2026

The Hair Studio provides private hairstyle visualizations on web and native mobile. A client uploads
one clear, front-facing headshot, chooses from the shared cutG style catalog or describes a custom
style, and may attach the completed preview atomically while booking. No live camera or face-scanning
experience is used.

## Privacy and storage

- Clients consent to private headshot processing and confirm they are at least 18 before an upload
  session is created.
- Images are resized and uploaded directly to private S3-compatible storage through short-lived
  presigned URLs. Image bytes never travel through Express JSON or navigation parameters.
- The FastAPI service downloads only API-issued signed capture URLs, verifies image type and size,
  and uses MediaPipe Tasks to reject unreadable, too-small, dark, overexposed, blurry, incorrectly
  posed, distant, hairline-cropped, or non-single-face headshots. The portrait must pass this
  server-side quality check before generation.
- Raw scan objects expire after `AI_SCAN_RETENTION_HOURS` (24 hours by default). Generated previews
  remain private until the client deletes them.
- fal.ai output is copied immediately into cutG-owned private storage. Browser and mobile clients
  receive short-lived signed URLs only.
- `FAL_KEY` belongs only in the server environment. Never expose it through Express responses,
  Next.js public variables, or Expo variables.

## Architecture

```text
Web or native single-headshot upload
  -> presigned private S3 upload
  -> Express ownership, consent, limits, and idempotency
  -> FastAPI MediaPipe quality validation
  -> Redis RQ durable generation job
  -> Python worker: mock or FLUX.1 Kontext Pro via fal.ai
  -> authenticated processing/completion/failure callback
  -> Express copies output to private S3 and records usage
  -> web/mobile poll the owned design and can book with designId
```

The Python service has no database credentials. Express remains the source of truth for users,
limits, job state, storage ownership, usage, and appointment attachment. Internal requests use the
same minimum-32-character `AI_INTERNAL_SECRET` and callback comparison is timing safe.

## Providers and limits

`AI_PROVIDER=mock` is the local and CI default. It returns the accepted portrait as a deterministic
zero-cost result while exercising RQ, callbacks, storage, polling, deletion, and booking.

`AI_PROVIDER=fal` uses `fal-ai/flux-pro/kontext`. The worker submits the private front portrait with
the hardened hair-only prompt, disables prompt enhancement, requires exactly one JPEG result, and
records provider request ID, duration, and estimated cost. An uncertain paid submission is not
automatically retried. A real smoke test is opt-in and requires funded `FAL_KEY` credentials.

One client may have one active generation and five delivered previews per rolling 24 hours by
default. Failed and cancelled jobs do not consume the quota. The optional monthly budget ceiling
can pause new generation without removing saved designs.

## API

All public routes require an authenticated `CLIENT`:

```http
GET    /clients/me/hair-studio/config
POST   /clients/me/hair-scans
GET    /clients/me/hair-scans/:scanId
POST   /clients/me/hair-scans/:scanId/captures/presign
POST   /clients/me/hair-scans/:scanId/captures/:captureId/complete
POST   /clients/me/hair-scans/:scanId/validate
POST   /clients/me/hair-scans/:scanId/complete
GET    /clients/me/designs
POST   /clients/me/designs/generate
GET    /clients/me/designs/:designId
POST   /clients/me/designs/:designId/retry
DELETE /clients/me/designs/:designId
POST   /clients/me/designs/:designId/attach
```

Generation and retry return `202`. Poll while `generationStatus` is `QUEUED` or `PROCESSING`; stop
on `COMPLETED`, `FAILED`, or `CANCELLED`. Booking accepts optional `designId` and validates/attaches
the completed owned preview in the appointment transaction. The standalone attach route remains for
legacy written briefs.

## Local setup

```bash
make up
make ai-install
make migrate
make dev
```

`make ai-install` creates `services/ai/.venv`, installs pinned dependencies, and downloads the
official MediaPipe BlazeFace model. `pnpm dev` starts Express, Next.js, FastAPI, and the RQ worker.
Mobile uses the Expo photo library picker and does not require a camera development build.

Tests use mock provider mode:

```bash
pnpm typecheck
pnpm test:api
make ai-test
pnpm verify:hair-studio
```

The default verifier refuses to contact a paid provider. To run the opt-in real smoke test, start
the API and workers with server-only `AI_PROVIDER=fal` and `FAL_KEY`, then run:

```bash
HAIR_STUDIO_REAL_PROVIDER=1 pnpm verify:hair-studio
```

If the provider or credentials are unavailable, the verifier exits at the named
`real-provider-preflight` stage before creating a scan or submitting a paid request.
