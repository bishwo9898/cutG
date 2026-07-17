# AI Hair Studio

Last updated: July 16, 2026

Phase 10 turns `/client/design` into a web-first AI hairstyle studio. A client consents to face
processing, confirms they are at least 18, captures three guided still images, chooses practical
preferences, receives three cutG-controlled recommendations, and generates one private preview.

## Privacy Model

- The camera captures front, approximately 30-degree left, and approximately 30-degree right stills.
- Camera video, rejected frames, face landmarks, and landmark templates never leave the browser.
- MediaPipe Face Landmarker runs in a Web Worker for one-face, framing, orientation, and stability
  guidance.
- Captures are resized to at most 1600 pixels on the longest edge and encoded as JPEG at about 86%.
- Bright, sharp, single-face captures are uploaded directly to private S3-compatible storage.
- Raw captures expire after 24 hours by default.
- Generated previews remain private until client deletion. The API returns short-lived signed URLs.
- The UI always labels the output as an AI visualization, not a guaranteed haircut result.

## Local And Production Providers

`AI_PROVIDER=mock` is the default local provider. It returns controlled style recommendations and
copies the accepted front capture as a deterministic output, exercising the complete queue, storage,
authorization, polling, deletion, and appointment-attachment path without provider cost.

`AI_PROVIDER=gemini` uses the server-only `GEMINI_API_KEY`, a low-cost suggestion model, and
`gemini-3.1-flash-image` for the final image. Production face processing must use a paid Gemini
project. Do not use unpaid/free-tier processing for client face images.

The versioned image prompt changes scalp hair only and explicitly preserves identity, skin tone,
expression, facial hair, body, clothing, lighting, and background. Recommendations are restricted to
the cutG preset catalog and must not infer sensitive traits.

References:

- [Gemini image generation](https://ai.google.dev/gemini-api/docs/image-generation)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API terms](https://ai.google.dev/gemini-api/terms)
- [MediaPipe Face Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js)

## Architecture

```text
Browser camera
  -> client-side MediaPipe and image quality checks
  -> presigned PUT to private MinIO/S3
  -> Express creates an idempotent generation record
  -> BullMQ stores the durable Redis job
  -> apps/ai-worker downloads private captures
  -> mock or Gemini provider
  -> private generated object
  -> PostgreSQL status and usage ledger
  -> browser polls every 3 seconds and receives a signed preview URL
```

The API never accepts image bytes in JSON. One client can have one active generation and three
attempts per rolling 24 hours by default. A global feature flag, daily limit, worker concurrency,
and optional monthly budget ceiling can pause new work without deleting saved briefs.

BullMQ jobs use stable job IDs and database idempotency keys. Provider calls are not automatically
retried after uncertain submission. A worker restart marks stale in-flight generations as failed and
requires an explicit client retry, preventing accidental duplicate image charges.

## API

All routes require a `CLIENT` bearer token:

```http
GET    /clients/me/hair-studio/config
POST   /clients/me/hair-scans
GET    /clients/me/hair-scans/:scanId
POST   /clients/me/hair-scans/:scanId/captures/presign
POST   /clients/me/hair-scans/:scanId/captures/:captureId/complete
POST   /clients/me/hair-scans/:scanId/complete
POST   /clients/me/designs/generate
GET    /clients/me/designs/:designId
POST   /clients/me/designs/:designId/retry
DELETE /clients/me/designs/:designId
```

Generation and retry return `202`. Poll `GET /clients/me/designs/:designId` every three seconds while
`generationStatus` is `QUEUED` or `PROCESSING`. Stop on `COMPLETED`, `FAILED`, or `CANCELLED`.

The original textual brief endpoints remain supported:

```http
POST /clients/me/designs
GET  /clients/me/designs
POST /clients/me/designs/:designId/attach
```

Deleting a generated preview removes image access and detaches the image relation from appointments.
Existing appointment style notes remain useful as barber-facing context.

## Database

Migration `010_ai_hair_studio.ts` adds:

- `hair_scan_sessions`: consent, ownership, preferences, analysis state, suggestions, and expiry.
- `hair_scan_captures`: private object metadata, checksum, angle, dimensions, and quality metrics.
- `hair_design_generations`: provider state, prompt/model version, idempotency, output, usage, and errors.
- `ai_usage_events`: immutable provider usage and estimated-cost ledger.
- Private generated-asset, current-generation, failure, and soft-delete fields on
  `client_hair_designs`.

## Operations

Local services:

```bash
make setup
make dev
```

`make dev` starts API, web, and AI worker. MinIO is available at `http://localhost:9000`; its local
console is `http://localhost:9001`. Objects are private and the bucket is created by `minio-init`.

Set `AI_MOCK_FAILURE=true` only when intentionally testing the retry/error experience. Python is
deferred until a benchmarked self-hosted model matches hosted quality and sustained spend justifies
dedicated NVIDIA GPU operations.
