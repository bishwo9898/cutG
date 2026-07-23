import type { HairPreferences } from '@barber-saas/shared-types';

import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';

type Frame = { captureId: string; angle: string; url: string };
type ValidationResult = {
  selectedCaptureId: string;
  metrics: Array<{
    captureId: string;
    angle: string;
    width: number;
    height: number;
    brightness: number;
    sharpness: number;
    faceCount: number;
    faceSize: number;
    yaw: number;
    hairlineVisible: boolean;
    poseScore: number;
    qualityScore: number;
    accepted: boolean;
    rejectionReason: string | null;
  }>;
  suggestions: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    reason: string;
  }>;
};

const request = async <T>(path: string, init: RequestInit): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${env.AI_SERVICE_URL}${path}`, {
      ...init,
      headers: {
        'X-CutG-AI-Secret': env.AI_INTERNAL_SECRET,
        'Content-Type': 'application/json',
        ...init.headers,
      },
      signal: AbortSignal.timeout(95_000),
    });
  } catch {
    throw new AppError(503, 'The AI image service is unavailable.', 'AI_SERVICE_UNAVAILABLE');
  }
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const detail = body.detail;
    const structuredDetail =
      typeof detail === 'object' && detail !== null ? (detail as Record<string, unknown>) : null;
    const rejectedFrames = Array.isArray(structuredDetail?.rejected_frames)
      ? structuredDetail.rejected_frames
          .filter(
            (frame): frame is Record<string, unknown> =>
              typeof frame === 'object' && frame !== null,
          )
          .map((frame) => ({
            captureId: String(frame.capture_id ?? ''),
            angle: String(frame.angle ?? ''),
            reason: String(frame.reason ?? 'Image quality is too low.'),
          }))
      : [];
    const message =
      typeof detail === 'string'
        ? detail
        : typeof structuredDetail?.message === 'string'
          ? structuredDetail.message
          : 'AI image processing failed.';
    throw new AppError(
      response.status === 422 ? 422 : 503,
      message,
      response.status === 422 ? 'HAIR_SCAN_REJECTED' : 'AI_SERVICE_ERROR',
      rejectedFrames.length === 0 ? undefined : { rejectedFrames },
    );
  }
  return body as T;
};

const preferencesPayload = (preferences?: HairPreferences): Record<string, string> | undefined =>
  preferences === undefined
    ? undefined
    : {
        desired_length: preferences.desiredLength,
        maintenance: preferences.maintenance,
        texture: preferences.texture,
        fade_preference: preferences.fadePreference,
        overall_style: preferences.overallStyle,
      };

export const validateAiFrames = async (
  frames: Frame[],
  preferences?: HairPreferences,
): Promise<ValidationResult> => {
  const result = await request<{
    selected_capture_id: string;
    metrics: Array<Record<string, unknown>>;
    suggestions: ValidationResult['suggestions'];
  }>('/ai/validate-frames', {
    method: 'POST',
    body: JSON.stringify({
      frames: frames.map((frame) => ({
        capture_id: frame.captureId,
        angle: frame.angle,
        url: frame.url,
      })),
      preferences: preferencesPayload(preferences),
    }),
  });
  return {
    selectedCaptureId: result.selected_capture_id,
    metrics: result.metrics.map((metric) => ({
      captureId: String(metric.capture_id),
      angle: String(metric.angle),
      width: Number(metric.width),
      height: Number(metric.height),
      brightness: Number(metric.brightness),
      sharpness: Number(metric.sharpness),
      faceCount: Number(metric.face_count),
      faceSize: Number(metric.face_size),
      yaw: Number(metric.yaw),
      hairlineVisible: Boolean(metric.hairline_visible),
      poseScore: Number(metric.pose_score),
      qualityScore: Number(metric.quality_score),
      accepted: Boolean(metric.accepted),
      rejectionReason: typeof metric.rejection_reason === 'string' ? metric.rejection_reason : null,
    })),
    suggestions: result.suggestions,
  };
};

export const enqueueAiGeneration = async (input: {
  generationId: string;
  inputUrl: string;
  prompt: string;
  editRegion: 'scalp' | 'facial' | 'combo';
}): Promise<{ jobId: string; status: string }> => {
  const result = await request<{ job_id: string; status: string }>('/ai/generations', {
    method: 'POST',
    body: JSON.stringify({
      generation_id: input.generationId,
      input_url: input.inputUrl,
      prompt: input.prompt,
      edit_region: input.editRegion,
    }),
  });
  return { jobId: result.job_id, status: result.status };
};
