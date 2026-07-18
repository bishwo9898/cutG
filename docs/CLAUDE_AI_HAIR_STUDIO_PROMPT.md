# Claude implementation prompt: AI Hair Studio

You are working in the cutG monorepo. Implement and verify the AI Hair Studio end to end. Preserve
existing architecture, design patterns, authentication, private storage, user changes, and tests.
Do not replace working infrastructure or expose provider credentials to web or mobile clients.

## Product outcome

Build a fast, calm face-scan flow that automatically captures clear front, left, and right views.
Use on-device face guidance before upload. The user should see one short instruction at a time,
hold still briefly, receive subtle success feedback, and move to the next angle automatically.

Validate every submitted image before paid generation. Reject images that are blurry, too dark,
overexposed, too small, contain zero or multiple faces, crop the hairline, place the face too far
away, or use the wrong head angle. Return structured angle-specific rejection data and take the
user directly back to the first failed angle. Allow retaking that capture without recreating the
whole scan. Never silently accept a scan when one of its submitted angles failed.

After validation, let the user either select a hairstyle preset or choose "Describe my own" and
type a custom hairstyle. Custom descriptions must support length, texture, fade/taper placement,
shape, styling, facial-hair changes, and color. Generate exactly one image for each explicit user
request for now.

The image model must edit only the requested scalp hair or facial hair. Preserve the same identity,
face, skin, expression, eyes, eyebrows, ears, body, clothes, pose, crop, camera/lens perspective,
lighting, shadows, color grade, and background. Do not beautify, age, reshape, relight, add text,
make a collage, or return alternate versions. Keep hairlines, strands, density, edges, and blending
photorealistic.

## Existing architecture to use

- Mobile scan UI: `apps/mobile/src/app/(client)/design/scan.tsx`
- Mobile style and result UI: `apps/mobile/src/app/(client)/design/`
- Web studio: `apps/web/src/app/client/design/page.tsx`
- Express orchestration: `apps/api/src/services/design/hairStudioService.ts`
- Provider prompt: `apps/api/src/services/design/hairPrompt.ts`
- Node-to-Python client: `apps/api/src/services/design/aiHairServiceClient.ts`
- FastAPI validation and queue: `services/ai/app/main.py`
- Image quality analysis: `services/ai/app/image_validation.py`
- Provider adapter: `services/ai/app/providers.py`
- RQ worker and callbacks: `services/ai/app/tasks.py`
- Private generated-image storage is completed by the Express callback flow. Keep generated images
  in private S3/MinIO and expose only short-lived authorized URLs.

## Provider and safety requirements

Local `AI_PROVIDER=mock` is only a pipeline test and returns the source portrait unchanged. Real
hairstyle edits require `AI_PROVIDER=fal` and a server-only funded `FAL_KEY`. Keep `num_images=1`,
disable provider prompt enhancement, use the hardened hairstyle-only prompt, and copy the provider
result immediately into private application storage. Never place `FAL_KEY` in public environment
variables, API responses, logs, or client bundles.

Do not automatically retry after an uncertain paid-provider submission. Keep idempotency, daily
limits, budget controls, generation state transitions, worker authentication, cleanup, and raw-scan
retention intact.

## Acceptance criteria

1. Front, left, and right capture feels automatic and quick on a native development build.
2. Each submitted frame must pass server validation; failures identify the exact angle and reason.
3. A failed angle can be retaken without abandoning the scan.
4. Preset and free-text custom hairstyles both generate valid requests.
5. The provider receives a strict hairstyle-only prompt and requests exactly one output image.
6. Completed images are copied to private S3/MinIO and appear in the user's saved looks.
7. Other users cannot read the scan or result, and provider keys never reach a client.
8. Mock end-to-end verification passes locally; a real-provider smoke test is opt-in and only runs
   when `FAL_KEY` is present.
9. Python tests, API tests, mobile/web tests, lint, and TypeScript checks pass.

Before editing, inspect current uncommitted changes and preserve them. After implementation, run the
smallest relevant tests first, then the full Hair Studio verification. Report the exact failing
stage if a real-provider test cannot run because credentials are missing.
