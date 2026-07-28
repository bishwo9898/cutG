import { z } from 'zod';

export const HairDesignCategorySchema = z.enum(['haircut', 'beard', 'color', 'combo']);
export const HairScanAngleSchema = z.literal('FRONT');
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

export const AcceptHairStudioConsentSchema = z.object({
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
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  sizeBytes: z.number().int().min(10_000).max(4_000_000),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
});

export const CompleteHairCaptureSchema = z.object({
  width: z.number().int().min(200).max(6000),
  height: z.number().int().min(200).max(6000),
  brightness: z.number().min(0).max(255).optional(),
  sharpness: z.number().nonnegative().max(1_000_000).optional(),
  faceCount: z.number().int().min(0).max(10).optional(),
  poseScore: z.number().min(0).max(1).optional(),
});

export const CompleteHairScanSchema = z.object({ preferences: HairPreferencesSchema });
export const ValidateHairScanSchema = z.object({ preferences: HairPreferencesSchema.optional() });

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
export type AcceptHairStudioConsentRequest = z.infer<typeof AcceptHairStudioConsentSchema>;
export type PresignHairCaptureRequest = z.infer<typeof PresignHairCaptureSchema>;
export type CompleteHairCaptureRequest = z.infer<typeof CompleteHairCaptureSchema>;
export type CompleteHairScanRequest = z.infer<typeof CompleteHairScanSchema>;
export type ValidateHairScanRequest = z.infer<typeof ValidateHairScanSchema>;
export type GenerateHairDesignRequest = z.infer<typeof GenerateHairDesignSchema>;
export type RetryHairDesignRequest = z.infer<typeof RetryHairDesignSchema>;
export type HairScanAngle = z.infer<typeof HairScanAngleSchema>;
export type HairGenerationStatus = z.infer<typeof HairGenerationStatusSchema>;

export const HairDesignParamsSchema = z.object({ designId: z.string().uuid() });
export const AttachHairDesignSchema = z.object({ appointmentId: z.string().uuid() });

export const AI_HAIR_CONSENT_VERSION = '2026-07-17';

export const HAIR_STYLE_CATALOG = [
  {
    id: 'textured-crop',
    name: 'Textured Crop',
    category: 'haircut',
    description: 'Short textured top with a clean tapered perimeter.',
  },
  {
    id: 'low-taper',
    name: 'Low Taper',
    category: 'haircut',
    description: 'A subtle taper that keeps natural weight through the sides.',
  },
  {
    id: 'mid-fade',
    name: 'Mid Fade',
    category: 'haircut',
    description: 'Balanced fade placement with a crisp transition.',
  },
  {
    id: 'burst-fade',
    name: 'Burst Fade',
    category: 'haircut',
    description: 'Rounded fade around the ear with length through the back.',
  },
  {
    id: 'classic-pompadour',
    name: 'Classic Pompadour',
    category: 'haircut',
    description: 'Structured volume swept back with tidy sides.',
  },
  {
    id: 'curly-shape-up',
    name: 'Curly Shape Up',
    category: 'haircut',
    description: 'Natural curls retained with a precise outline.',
  },
  {
    id: 'buzz-cut',
    name: 'Buzz Cut',
    category: 'haircut',
    description: 'Even, close length with a sharp hairline.',
  },
  {
    id: 'slick-back',
    name: 'Slick Back',
    category: 'haircut',
    description: 'Longer top directed back with controlled sides.',
  },
  {
    id: 'boxed-beard',
    name: 'Boxed Beard',
    category: 'beard',
    description: 'Structured cheek and jaw lines with balanced fullness.',
  },
  {
    id: 'short-beard-fade',
    name: 'Short Beard Fade',
    category: 'beard',
    description: 'A close beard blended cleanly into the sideburns.',
  },
  {
    id: 'goatee-detail',
    name: 'Detailed Goatee',
    category: 'beard',
    description: 'Focused chin and moustache definition with clean cheeks.',
  },
  {
    id: 'warm-brown',
    name: 'Warm Brown',
    category: 'color',
    description: 'Natural warm-brown tone with dimensional variation.',
  },
  {
    id: 'platinum-top',
    name: 'Platinum Top',
    category: 'color',
    description: 'Cool platinum tone focused through the top.',
  },
  {
    id: 'silver-blend',
    name: 'Silver Blend',
    category: 'color',
    description: 'Soft silver blending that keeps realistic tonal depth.',
  },
  {
    id: 'crop-beard-combo',
    name: 'Crop + Beard Blend',
    category: 'combo',
    description: 'Textured crop and beard connected with one continuous fade.',
  },
  {
    id: 'pompadour-boxed-beard',
    name: 'Pompadour + Boxed Beard',
    category: 'combo',
    description: 'Polished volume paired with a structured beard.',
  },
] as const;
