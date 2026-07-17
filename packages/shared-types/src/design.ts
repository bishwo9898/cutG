import { z } from 'zod';

export const HairDesignCategorySchema = z.enum(['haircut', 'beard', 'color']);
export const HairScanAngleSchema = z.enum(['FRONT', 'LEFT', 'RIGHT']);
export const HairScanStatusSchema = z.enum(['CAPTURING', 'READY', 'EXPIRED', 'DELETED']);
export const HairScanAnalysisStatusSchema = z.enum([
  'NOT_STARTED',
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
]);
export const HairGenerationStatusSchema = z.enum([
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

export const HairPreferencesSchema = z.object({
  desiredLength: z.enum(['very-short', 'short', 'medium', 'long', 'keep-length']),
  maintenance: z.enum(['low', 'moderate', 'high']),
  texture: z.enum(['natural', 'straight', 'wavy', 'curly', 'coily']),
  fadePreference: z.enum(['none', 'low', 'mid', 'high', 'taper']),
  overallStyle: z.enum(['classic', 'clean', 'modern', 'bold', 'professional']),
});
export type HairPreferences = z.infer<typeof HairPreferencesSchema>;

export const CreateHairScanSchema = z.object({
  consentAccepted: z.literal(true),
  ageConfirmed: z.literal(true),
  consentVersion: z.string().trim().min(1).max(50),
});

export const HairScanParamsSchema = z.object({ scanId: z.string().uuid() });
export const HairCaptureParamsSchema = z.object({
  scanId: z.string().uuid(),
  captureId: z.string().uuid(),
});

export const PresignHairCaptureSchema = z.object({
  angle: HairScanAngleSchema,
  mimeType: z.enum(['image/jpeg', 'image/webp']),
  sizeBytes: z.number().int().min(10_000).max(3_000_000),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
});

export const CompleteHairCaptureSchema = z.object({
  width: z.number().int().min(320).max(2000),
  height: z.number().int().min(320).max(2000),
  brightness: z.number().min(0).max(255),
  sharpness: z.number().nonnegative().max(100_000),
  faceCount: z.literal(1),
  poseScore: z.number().min(0).max(1),
});

export const CompleteHairScanSchema = z.object({ preferences: HairPreferencesSchema });

export const GenerateHairDesignSchema = z.object({
  scanId: z.string().uuid(),
  styleName: z.string().trim().min(1).max(100),
  styleCategory: HairDesignCategorySchema,
  description: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().uuid(),
});

export const RetryHairDesignSchema = z.object({ idempotencyKey: z.string().uuid() });

export const CreateHairDesignSchema = z.object({
  styleName: z.string().trim().min(1).max(100),
  styleCategory: HairDesignCategorySchema,
  description: z.string().trim().max(2000).optional(),
  sourcePhotoUrl: z.string().url().max(2000).optional(),
});
export type CreateHairDesignRequest = z.infer<typeof CreateHairDesignSchema>;
export type CreateHairScanRequest = z.infer<typeof CreateHairScanSchema>;
export type PresignHairCaptureRequest = z.infer<typeof PresignHairCaptureSchema>;
export type CompleteHairCaptureRequest = z.infer<typeof CompleteHairCaptureSchema>;
export type CompleteHairScanRequest = z.infer<typeof CompleteHairScanSchema>;
export type GenerateHairDesignRequest = z.infer<typeof GenerateHairDesignSchema>;
export type RetryHairDesignRequest = z.infer<typeof RetryHairDesignSchema>;
export type HairScanAngle = z.infer<typeof HairScanAngleSchema>;
export type HairGenerationStatus = z.infer<typeof HairGenerationStatusSchema>;

export const HairDesignParamsSchema = z.object({ designId: z.string().uuid() });
export const AttachHairDesignSchema = z.object({ appointmentId: z.string().uuid() });

export const AI_HAIR_QUEUE_NAME = 'cutg-ai-hair';
export const AI_HAIR_CONSENT_VERSION = '2026-07-16';

export type HairStudioJob =
  | { kind: 'ANALYZE_SCAN'; scanId: string; clientId: string }
  | { kind: 'GENERATE_DESIGN'; generationId: string; clientId: string };
