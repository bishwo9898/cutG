# AI Hair Studio

Last updated: July 21, 2026

The Hair Studio provides private hairstyle visualizations on web and native mobile. A client can
take a new camera photo or upload an existing portrait, choose from the shared cutG style catalog or
describe a custom style, and attach the completed preview atomically while booking.

## Privacy and storage

- Clients consent to private headshot processing and confirm they are at least 18 before an upload
  session is created.
- Images are resized and uploaded directly to private S3-compatible storage through short-lived
  presigned URLs. Image bytes never travel through Express JSON or navigation parameters.
- The FastAPI service downloads only API-issued signed capture URLs, verifies image type and size,
  and uses MediaPipe Tasks to record capture-quality metrics. Unreadable and too-small images remain
  blocked. Other quality boundaries are advisory in permissive testing mode and enforced when strict
  validation is enabled.
- Raw scan objects expire after `AI_SCAN_RETENTION_HOURS` (24 hours by default). Generated previews
  remain private until the client deletes them.
- fal.ai output is copied immediately into cutG-owned private storage. Browser and mobile clients
  receive short-lived signed URLs only.
- `FAL_KEY` belongs only in the server environment. Never expose it through Express responses,
  Next.js public variables, or Expo variables.

## Architecture

```text
Web live camera, native camera, or private single-headshot upload
  -> presigned private S3 upload
  -> Express ownership, consent, limits, and idempotency
  -> FastAPI MediaPipe quality validation
  -> Redis RQ durable generation job
  -> Python worker: mock or GPT Image 2 Edit via fal.ai
  -> authenticated processing/completion/failure callback
  -> Express copies output to private S3 and records usage
  -> web/mobile poll the owned design and can book with designId
```

The Python service has no database credentials. Express remains the source of truth for users,
limits, job state, storage ownership, usage, and appointment attachment. Internal requests use the
same minimum-32-character `AI_INTERNAL_SECRET` and callback comparison is timing safe.

## Providers and limits

`AI_PROVIDER=mock` is the local and CI default. It returns the accepted portrait as a deterministic
zero-cost result while exercising RQ, callbacks, storage, polling, deletion, and booking. It does
not alter the hairstyle; the UI labels this as demo mode.

`AI_PROVIDER=fal` uses `openai/gpt-image-2/edit` through fal.ai at high quality. The worker submits
the private front portrait with the versioned `gpt-image-2-masked-hair-v2` prompt and a deterministic
scalp, facial-hair, or combined edit mask derived from the centered capture contract. Every preset
expands into concrete barber geometry, length, texture, blending, region, identity-preservation, and
photographic-realism constraints. Scalp masks include the complete original hair silhouette so
short cuts can reconstruct the background instead of retaining old fringe or side tufts. Buzz-cut
and perm prompts also require complete replacement of the old hairstyle rather than layering.
Exactly one PNG result is required. The worker then composites
only the feathered edit region over the normalized source before cutG copies it into private
storage. This makes preservation of the face, skin, clothes, lighting, and background deterministic
rather than relying on prompt compliance alone. Provider request ID, duration, and estimated cost
are recorded. An uncertain paid submission is not automatically retried. A real smoke test is
opt-in and requires funded `FAL_KEY` credentials.

`AI_GENERATION_QUALITY` defaults to `high`. `AI_USE_HAIR_MASK=true` is the production default and
should only be disabled for provider diagnosis. The legacy FLUX Kontext adapter remains available
when explicitly selected with `AI_GENERATION_MODEL`, but it does not provide GPT Image 2's masked
edit and preservation-composite path.

`AI_STRICT_CAPTURE_VALIDATION=false` is the testing default. The validator still requires a
readable image of at least 200 × 200 pixels, but pose, lighting, blur, detected face count, framing,
and hairline metrics become advisory and do not block generation. Set the flag to `true` before a
quality-controlled public launch.

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
Web uses `getUserMedia` with a native `capture="user"` fallback. Mobile uses Expo Image Picker for
camera and photo-library capture; native builds include explicit camera and photo permission text.

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

## How generation moves through the system

1. Express creates a `QUEUED` generation and sends a short-lived signed source URL to FastAPI.
2. FastAPI verifies that an RQ worker is registered before putting the job in Redis.
3. The RQ worker calls Express to move the generation to `PROCESSING`.
4. In `mock` mode the worker returns the source portrait unchanged. In `fal` mode it submits the
   identity-preserving edit request to fal.ai and waits for one JPEG output.
5. The worker calls Express with completion or failure. Express copies a successful output into
   private cutG storage and only then marks the generation `COMPLETED`.

The browser never calls fal.ai and never receives `FAL_KEY`. A real hairstyle transformation only
occurs when the server and worker are explicitly started with `AI_PROVIDER=fal` and a valid funded
`FAL_KEY`.

For local real-provider testing, set `AI_PROVIDER=fal` in the root `.env.local` so Express and Python
agree on job metadata. Put only the credential in the ignored `services/ai/.env` file so Node,
browsers, and Expo never load it:

```env
# services/ai/.env
FAL_KEY=your-server-only-key
```

Restart FastAPI and the RQ worker after changing provider configuration. Mock jobs and health output
use the explicit model label `mock-passthrough`; seeing that label guarantees fal.ai was not called.

## Queue troubleshooting

Check the complete AI runtime with:

```bash
curl http://localhost:8000/health
```

Healthy generation requires `"worker_ready": true`. Start all four development processes with
`pnpm dev`, or start the missing worker separately with `make ai-worker`. The worker launcher retries
Redis connection failures instead of exiting permanently. FastAPI rejects new generation requests
when no worker is available, and Express converts queued jobs that never start into retryable
`AI_JOB_STALE` failures rather than leaving the UI spinning forever.
