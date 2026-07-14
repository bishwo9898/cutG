# Hair Design Studio

Last updated: July 13, 2026

Phase 9 introduces a style-brief workflow that is useful before AI image generation is connected. Clients choose a category and preset, optionally select a local reference photo, write detailed instructions, save the look, and attach it to an appointment. Barbers see the attached name, description, and available reference URLs.

## Current Scope

- Web studio: `/client/design`.
- Native studio: `/(client)/design`.
- Categories: haircut, beard, and color.
- Curated style presets with human-readable descriptions.
- Intentional `AI preview coming soon` state.
- Saved textual briefs with `ai_status = placeholder`.
- Attachment to a client-owned appointment.
- Barber web and native appointment views include the style reference.

Local file previews remain on the device/browser because production object storage is not connected. The API accepts an optional hosted `sourcePhotoUrl`; it does not store base64 image uploads.

## API

```http
POST /clients/me/designs
GET /clients/me/designs
POST /clients/me/designs/:designId/attach
```

Design and appointment ownership are verified independently. Attachment updates `appointments.style_reference_id`, copies the description into `appointments.style_notes`, and links the design to the appointment in one transaction.

## Database

Migration `007_new_features.ts` creates `client_hair_designs` and adds `style_reference_id` and `style_notes` to appointments. Deleting a design or appointment safely clears the optional relationship. The updated-at trigger and client/appointment indexes follow existing foundation conventions.

## Phase 10 AI Integration

The current contract is ready for an asynchronous image pipeline:

1. Upload source photos to private object storage with signed access.
2. Set `ai_status` to `processing` and enqueue a generation job.
3. Apply consent, content-safety, retention, and face-image privacy rules.
4. Generate a preview through the selected provider.
5. Store the output URL and set `ai_status` to `completed` or `failed`.
6. Notify the client without blocking booking or attachment.

Future environment placeholders are `OPENAI_API_KEY` and `AI_IMAGE_GENERATION_ENABLED`; neither is used in Phase 9.
