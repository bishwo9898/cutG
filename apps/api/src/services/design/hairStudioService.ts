/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type {
  AcceptHairStudioConsentRequest,
  CompleteHairCaptureRequest,
  CompleteHairScanRequest,
  CreateHairScanRequest,
  GenerateHairDesignRequest,
  HairScanAngle,
  PresignHairCaptureRequest,
  RetryHairDesignRequest,
  ValidateHairScanRequest,
} from '@barber-saas/shared-types';
import { AI_HAIR_CONSENT_VERSION } from '@barber-saas/shared-types';

import { env } from '../../config/env';
import { query, withTransaction, type DatabaseExecutor } from '../../db/queries/barber.queries';
import { AppError } from '../../middleware/errorHandler';
import {
  createPrivateCloudinaryUrl,
  deletePrivateCloudinaryImage,
  isCloudinaryEnabled,
  storePrivateCloudinaryImage,
  type CloudinaryImage,
} from '../storage/cloudinaryStorage';
import {
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  deleteStoredObject,
  downloadRemoteImage,
  storeImageBuffer,
  verifyUploadedObject,
  type DownloadedImage,
} from '../storage/objectStorage';

import { enqueueAiGeneration, validateAiFrames } from './aiHairServiceClient';
import { buildHairEditPrompt, HAIR_PROMPT_VERSION } from './hairPrompt';

type Row = Record<string, unknown>;
const REQUIRED_ANGLES: HairScanAngle[] = ['FRONT'];
const GENERATION_MODEL = env.AI_PROVIDER === 'mock' ? 'mock-passthrough' : env.AI_GENERATION_MODEL;
const DEBUG_ARTIFACT_ROOT = resolve(__dirname, '../../../../../tmp/hair-studio-debug');
const iso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
const editRegion = (category: string): 'scalp' | 'facial' | 'combo' =>
  category === 'beard' ? 'facial' : category === 'combo' ? 'combo' : 'scalp';
const extensionFromContentType = (contentType: string): string =>
  contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';

const saveDebugArtifacts = async (input: {
  clientId: string;
  designId: string;
  generationId: string;
  sourceAssetKey: string | null;
  providerOutputUrl: string;
  providerImage: DownloadedImage;
  storedOutputKey: string;
}): Promise<void> => {
  const folder = resolve(DEBUG_ARTIFACT_ROOT, input.clientId, input.designId, input.generationId);
  await mkdir(folder, { recursive: true });

  let sourceFileName: string | null = null;
  let sourceContentType: string | null = null;
  if (input.sourceAssetKey !== null) {
    const sourceImage = await downloadRemoteImage(
      await createPresignedDownloadUrl(input.sourceAssetKey),
    );
    sourceFileName = `source-uploaded.${extensionFromContentType(sourceImage.contentType)}`;
    sourceContentType = sourceImage.contentType;
    await writeFile(resolve(folder, sourceFileName), sourceImage.body);
  }

  const providerFileName = `fal-returned.${extensionFromContentType(input.providerImage.contentType)}`;
  await writeFile(resolve(folder, providerFileName), input.providerImage.body);
  await writeFile(
    resolve(folder, 'metadata.json'),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        clientId: input.clientId,
        designId: input.designId,
        generationId: input.generationId,
        sourceAssetKey: input.sourceAssetKey,
        sourceFileName,
        sourceContentType,
        providerOutputUrl: input.providerOutputUrl,
        providerFileName,
        providerContentType: input.providerImage.contentType,
        providerSizeBytes: input.providerImage.sizeBytes,
        storedOutputKey: input.storedOutputKey,
      },
      null,
      2,
    ),
  );
};

const requireAiEnabled = (): void => {
  if (!env.ENABLE_AI_FEATURES) {
    throw new AppError(503, 'AI Hair Studio is temporarily unavailable.', 'AI_DISABLED');
  }
};

const getOwnedScan = async (
  clientId: string,
  scanId: string,
  executor?: DatabaseExecutor,
): Promise<Row> => {
  const rows = await query<Row>(
    `SELECT * FROM hair_scan_sessions
     WHERE id=$1 AND client_id=$2 AND deleted_at IS NULL`,
    [scanId, clientId],
    executor,
  );
  const scan = rows[0];
  if (scan === undefined) throw new AppError(404, 'Hair scan not found.', 'HAIR_SCAN_NOT_FOUND');
  return scan;
};

const getOwnedDesignRow = async (
  clientId: string,
  designId: string,
  executor?: DatabaseExecutor,
): Promise<Row> => {
  const rows = await query<Row>(
    `SELECT d.*,g.status AS generation_status,g.progress,g.provider,g.model,
      g.error_code AS generation_error_code,g.error_message AS generation_error_message
     FROM client_hair_designs d
     LEFT JOIN hair_design_generations g ON g.id=d.current_generation_id
     WHERE d.id=$1 AND d.client_id=$2 AND d.deleted_at IS NULL`,
    [designId, clientId],
    executor,
  );
  const design = rows[0];
  if (design === undefined) throw new AppError(404, 'Design not found.', 'DESIGN_NOT_FOUND');
  return design;
};

const signedAsset = async (row: Row, prefix: 'source' | 'generated'): Promise<string | null> => {
  const clientId = String(row.client_id ?? '');
  const key = row[`${prefix}_asset_key`];
  const legacyUrl = row[prefix === 'source' ? 'source_photo_url' : 'generated_preview_url'];
  const isOwnedKey =
    typeof key === 'string' &&
    (prefix === 'source'
      ? key.startsWith(`hair-scans/${clientId}/`)
      : key.startsWith(`hair-designs/${clientId}/`));
  if (isOwnedKey) return createPresignedDownloadUrl(key);
  return typeof legacyUrl === 'string' ? legacyUrl : null;
};

const cloudinaryAsset = (row: Row, prefix: 'source' | 'generated'): string | null => {
  const publicId = row[`${prefix}_cloudinary_public_id`];
  const rawVersion = row[`${prefix}_cloudinary_version`];
  const rawFormat = row[`${prefix}_cloudinary_format`];
  const storageRoot = env.CLOUDINARY_FOLDER.replace(/^\/+|\/+$/g, '');
  const expectedPrefix = `${storageRoot}/users/${String(row.client_id)}/looks/${String(row.id)}/`;
  if (
    !isCloudinaryEnabled() ||
    typeof publicId !== 'string' ||
    !publicId.startsWith(expectedPrefix)
  ) {
    return null;
  }
  return createPrivateCloudinaryUrl({
    publicId,
    version: typeof rawVersion === 'number' ? rawVersion : Number(rawVersion ?? 0) || null,
    format: typeof rawFormat === 'string' ? rawFormat : null,
  });
};

const mapDesign = async (row: Row) => {
  const sourceCloudinaryUrl = cloudinaryAsset(row, 'source');
  const generatedCloudinaryUrl = cloudinaryAsset(row, 'generated');
  return {
    id: row.id,
    styleName: row.style_name,
    styleCategory: row.style_category,
    description: row.description,
    sourcePhotoUrl: sourceCloudinaryUrl ?? (await signedAsset(row, 'source')),
    generatedPreviewUrl: generatedCloudinaryUrl ?? (await signedAsset(row, 'generated')),
    imageStorage: generatedCloudinaryUrl === null ? 'private-object-storage' : 'cloudinary',
    aiStatus: row.ai_status,
    generationStatus: row.generation_status ?? null,
    progress: Number(row.progress ?? (row.ai_status === 'completed' ? 100 : 0)),
    provider: row.provider ?? null,
    model: row.model ?? null,
    errorCode: row.generation_error_code ?? row.ai_error_code ?? null,
    errorMessage: row.generation_error_message ?? row.ai_error_message ?? null,
    appointmentId: row.appointment_id,
    createdAt: iso(row.created_at),
  };
};

const mapCapture = (row: Row) => ({
  id: row.id,
  angle: row.angle,
  uploadStatus: row.upload_status,
  width: row.width,
  height: row.height,
  quality: {
    brightness: row.brightness === null ? null : Number(row.brightness),
    sharpness: row.sharpness === null ? null : Number(row.sharpness),
    poseScore: row.pose_score === null ? null : Number(row.pose_score),
  },
});

const mapScan = async (row: Row, executor?: DatabaseExecutor) => {
  const captures = await query<Row>(
    'SELECT * FROM hair_scan_captures WHERE scan_session_id=$1 ORDER BY angle',
    [row.id],
    executor,
  );
  return {
    id: row.id,
    status: row.status,
    analysisStatus: row.analysis_status,
    analysisError: row.analysis_error,
    preferences: row.preferences,
    suggestions: row.suggestions,
    captures: captures.map(mapCapture),
    selectedCaptureId: row.selected_capture_id ?? null,
    expiresAt: iso(row.expires_at),
    createdAt: iso(row.created_at),
  };
};

const assertGenerationAllowance = async (
  clientId: string,
  executor: DatabaseExecutor,
): Promise<void> => {
  const active = await query<Row>(
    `SELECT 1 FROM hair_design_generations g JOIN client_hair_designs d ON d.id=g.design_id
     WHERE d.client_id=$1 AND g.status IN ('QUEUED','PROCESSING') LIMIT 1`,
    [clientId],
    executor,
  );
  if (active.length > 0) {
    throw new AppError(409, 'Finish the current preview before starting another.', 'AI_JOB_ACTIVE');
  }
  const daily = await query<Row>(
    `SELECT COUNT(*)::int AS count FROM ai_usage_events
     WHERE client_id=$1 AND event_type='IMAGE_GENERATED'
       AND created_at >= CURRENT_TIMESTAMP - interval '24 hours'`,
    [clientId],
    executor,
  );
  if (Number(daily[0]?.count ?? 0) >= env.AI_GENERATION_DAILY_LIMIT) {
    throw new AppError(429, 'Daily AI preview limit reached.', 'DAILY_LIMIT_REACHED');
  }
  if (env.AI_MONTHLY_BUDGET_CENTS > 0) {
    const budget = await query<Row>(
      `SELECT COALESCE(SUM(estimated_cost_cents),0)::numeric AS spent
       FROM ai_usage_events WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP)`,
      [],
      executor,
    );
    if (Number(budget[0]?.spent ?? 0) >= env.AI_MONTHLY_BUDGET_CENTS) {
      throw new AppError(503, 'AI preview budget is temporarily paused.', 'AI_BUDGET_REACHED');
    }
  }
};

export const getHairStudioConfig = () => ({
  enabled: env.ENABLE_AI_FEATURES,
  provider: env.AI_PROVIDER === 'mock' ? 'demo' : 'fal',
  consentVersion: AI_HAIR_CONSENT_VERSION,
  requiredAngles: REQUIRED_ANGLES,
  webRequiredAngles: REQUIRED_ANGLES,
  maxCaptureBytes: 4_000_000,
  retentionHours: env.AI_SCAN_RETENTION_HOURS,
  dailyGenerationLimit: env.AI_GENERATION_DAILY_LIMIT,
  isMock: env.AI_PROVIDER === 'mock',
  imageStorage: isCloudinaryEnabled() ? 'cloudinary' : 'private-object-storage',
});

export const getHairStudioConsent = async (clientId: string) => {
  const rows = await query<Row>(
    `SELECT consent_version,age_confirmed,face_processing_consented,accepted_at,updated_at
     FROM client_hair_studio_consents WHERE client_id=$1`,
    [clientId],
  );
  const consent = rows[0];
  const accepted =
    consent !== undefined &&
    consent.consent_version === AI_HAIR_CONSENT_VERSION &&
    consent.age_confirmed === true &&
    consent.face_processing_consented === true;
  return {
    accepted,
    ageConfirmed: consent?.age_confirmed === true,
    faceProcessingConsented: consent?.face_processing_consented === true,
    consentVersion: AI_HAIR_CONSENT_VERSION,
    acceptedAt:
      consent?.accepted_at === undefined || consent.accepted_at === null
        ? null
        : iso(consent.accepted_at),
  };
};

export const acceptHairStudioConsent = async (
  clientId: string,
  input: AcceptHairStudioConsentRequest,
) => {
  if (input.consentVersion !== AI_HAIR_CONSENT_VERSION) {
    throw new AppError(
      409,
      'The Hair Studio privacy notice changed. Review the latest confirmation.',
      'HAIR_CONSENT_OUTDATED',
    );
  }
  await query(
    `INSERT INTO client_hair_studio_consents
       (client_id,consent_version,age_confirmed,face_processing_consented)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (client_id) DO UPDATE SET
       consent_version=EXCLUDED.consent_version,
       age_confirmed=EXCLUDED.age_confirmed,
       face_processing_consented=EXCLUDED.face_processing_consented,
       accepted_at=CURRENT_TIMESTAMP,
       updated_at=CURRENT_TIMESTAMP`,
    [clientId, input.consentVersion, input.ageConfirmed, input.consentAccepted],
  );
  return getHairStudioConsent(clientId);
};

export const createHairScan = async (clientId: string, input: CreateHairScanRequest) => {
  requireAiEnabled();
  await acceptHairStudioConsent(clientId, input);
  const expiresAt = new Date(Date.now() + env.AI_SCAN_RETENTION_HOURS * 60 * 60 * 1000);
  const rows = await query<Row>(
    `INSERT INTO hair_scan_sessions (client_id,consent_version,age_confirmed,expires_at)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [clientId, input.consentVersion, input.ageConfirmed, expiresAt],
  );
  return mapScan(rows[0] as Row);
};

export const getHairScan = async (clientId: string, scanId: string) =>
  mapScan(await getOwnedScan(clientId, scanId));

export const presignHairCapture = async (
  clientId: string,
  scanId: string,
  input: PresignHairCaptureRequest,
) => {
  requireAiEnabled();
  const scan = await getOwnedScan(clientId, scanId);
  if (scan.status !== 'CAPTURING' || new Date(String(scan.expires_at)).getTime() <= Date.now()) {
    throw new AppError(409, 'This scan can no longer accept captures.', 'HAIR_SCAN_CLOSED');
  }
  const existing = await query<Row>(
    'SELECT * FROM hair_scan_captures WHERE scan_session_id=$1 AND angle=$2',
    [scanId, input.angle],
  );
  const captureId = String(existing[0]?.id ?? randomUUID());
  const extension =
    input.mimeType === 'image/png' ? 'png' : input.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const objectKey =
    typeof existing[0]?.object_key === 'string'
      ? existing[0].object_key
      : `hair-scans/${clientId}/${scanId}/${input.angle.toLowerCase()}-${captureId}.${extension}`;
  await query(
    `INSERT INTO hair_scan_captures
      (id,scan_session_id,angle,object_key,mime_type,size_bytes,checksum_sha256,delete_after)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (scan_session_id,angle) DO UPDATE SET
       object_key=EXCLUDED.object_key,mime_type=EXCLUDED.mime_type,size_bytes=EXCLUDED.size_bytes,
       checksum_sha256=EXCLUDED.checksum_sha256,upload_status='PENDING',width=NULL,height=NULL,
       brightness=NULL,sharpness=NULL,face_count=NULL,pose_score=NULL`,
    [
      captureId,
      scanId,
      input.angle,
      objectKey,
      input.mimeType,
      input.sizeBytes,
      input.checksumSha256.toLowerCase(),
      scan.expires_at,
    ],
  );
  return {
    captureId,
    angle: input.angle,
    uploadUrl: await createPresignedUploadUrl(objectKey, input.mimeType),
    expiresIn: env.S3_PRESIGNED_TTL_SECONDS,
    headers: { 'Content-Type': input.mimeType },
  };
};

export const completeHairCapture = async (
  clientId: string,
  scanId: string,
  captureId: string,
  input: CompleteHairCaptureRequest,
) => {
  const scan = await getOwnedScan(clientId, scanId);
  if (scan.status !== 'CAPTURING') {
    throw new AppError(409, 'This scan can no longer accept captures.', 'HAIR_SCAN_CLOSED');
  }
  const captures = await query<Row>(
    'SELECT * FROM hair_scan_captures WHERE id=$1 AND scan_session_id=$2',
    [captureId, scanId],
  );
  const capture = captures[0];
  if (capture === undefined) {
    throw new AppError(404, 'Hair scan capture not found.', 'HAIR_CAPTURE_NOT_FOUND');
  }
  try {
    await verifyUploadedObject(
      String(capture.object_key),
      String(capture.mime_type),
      Number(capture.size_bytes),
    );
  } catch {
    throw new AppError(422, 'The uploaded capture could not be verified.', 'HAIR_CAPTURE_INVALID');
  }
  const rows = await query<Row>(
    `UPDATE hair_scan_captures SET upload_status='VERIFIED',width=$1,height=$2,
      brightness=$3,sharpness=$4,face_count=$5,pose_score=$6 WHERE id=$7 RETURNING *`,
    [
      input.width,
      input.height,
      input.brightness ?? null,
      input.sharpness ?? null,
      input.faceCount ?? null,
      input.poseScore ?? null,
      captureId,
    ],
  );
  return mapCapture(rows[0] as Row);
};

export const validateHairScan = async (
  clientId: string,
  scanId: string,
  input: ValidateHairScanRequest,
) => {
  requireAiEnabled();
  const scan = await getOwnedScan(clientId, scanId);
  if (scan.status !== 'CAPTURING') {
    if (scan.status === 'READY') return mapScan(scan);
    throw new AppError(409, 'This scan can no longer be validated.', 'HAIR_SCAN_CLOSED');
  }
  const captures = await query<Row>(
    `SELECT * FROM hair_scan_captures WHERE scan_session_id=$1 AND upload_status='VERIFIED' ORDER BY angle`,
    [scanId],
  );
  const capturedAngles = new Set(captures.map((capture) => String(capture.angle)));
  const missingAngles = REQUIRED_ANGLES.filter((angle) => !capturedAngles.has(angle));
  if (missingAngles.length > 0) {
    throw new AppError(
      422,
      'Upload a front-facing headshot before continuing.',
      'HAIR_SCAN_INCOMPLETE',
      {
        rejectedFrames: missingAngles.map((angle) => ({
          captureId: '',
          angle,
          reason: 'A front-facing headshot has not been uploaded.',
        })),
      },
    );
  }
  await query(
    `UPDATE hair_scan_sessions SET analysis_status='PROCESSING',analysis_error=NULL,preferences=$1 WHERE id=$2`,
    [JSON.stringify(input.preferences ?? {}), scanId],
  );
  try {
    // Side profiles are retained as scan context, but generation currently uses only
    // the front portrait. Keep them out of the AI validation payload until the
    // generation pipeline is intentionally expanded to support multi-view inputs.
    const aiCaptures = captures.filter((capture) => String(capture.angle) === 'FRONT');
    const validation = await validateAiFrames(
      await Promise.all(
        aiCaptures.map(async (capture) => ({
          captureId: String(capture.id),
          angle: String(capture.angle),
          url: await createPresignedDownloadUrl(String(capture.object_key)),
        })),
      ),
      input.preferences,
    );
    await withTransaction(async (executor) => {
      for (const metric of validation.metrics) {
        await query(
          `UPDATE hair_scan_captures SET width=$1,height=$2,brightness=$3,sharpness=$4,
            face_count=$5,pose_score=$6 WHERE id=$7 AND scan_session_id=$8`,
          [
            metric.width,
            metric.height,
            metric.brightness,
            metric.sharpness,
            metric.faceCount,
            metric.poseScore,
            metric.captureId,
            scanId,
          ],
          executor,
        );
      }
      await query(
        `UPDATE hair_scan_sessions SET status='READY',analysis_status='COMPLETED',
          selected_capture_id=$1,validation_metrics=$2,suggestions=$3 WHERE id=$4 AND client_id=$5`,
        [
          validation.selectedCaptureId,
          JSON.stringify(validation.metrics),
          JSON.stringify(validation.suggestions),
          scanId,
          clientId,
        ],
        executor,
      );
    });
  } catch (error) {
    await query(
      `UPDATE hair_scan_sessions SET analysis_status='FAILED',analysis_error=$1 WHERE id=$2`,
      [error instanceof Error ? error.message : 'Image validation failed.', scanId],
    );
    throw error;
  }
  return mapScan(await getOwnedScan(clientId, scanId));
};

export const completeHairScan = async (
  clientId: string,
  scanId: string,
  input: CompleteHairScanRequest,
) => validateHairScan(clientId, scanId, input);

export const generateHairDesign = async (clientId: string, input: GenerateHairDesignRequest) => {
  requireAiEnabled();
  const result = await withTransaction(async (executor) => {
    const scan = await getOwnedScan(clientId, input.scanId, executor);
    if (scan.status !== 'READY' || typeof scan.selected_capture_id !== 'string') {
      throw new AppError(409, 'Validate a portrait before generating.', 'HAIR_SCAN_NOT_READY');
    }
    const duplicate = await query<Row>(
      `SELECT d.*,g.status AS generation_status,g.progress,g.provider,g.model,
        g.error_code AS generation_error_code,g.error_message AS generation_error_message
       FROM hair_design_generations g JOIN client_hair_designs d ON d.id=g.design_id
       WHERE g.idempotency_key=$1 AND d.client_id=$2`,
      [input.idempotencyKey, clientId],
      executor,
    );
    if (duplicate[0] !== undefined)
      return { design: duplicate[0], generationId: null, sourceKey: null, prompt: null };
    await assertGenerationAllowance(clientId, executor);
    const captures = await query<Row>(
      'SELECT object_key FROM hair_scan_captures WHERE id=$1 AND scan_session_id=$2',
      [scan.selected_capture_id, input.scanId],
      executor,
    );
    const sourceKey = String(captures[0]?.object_key ?? '');
    if (sourceKey === '')
      throw new AppError(409, 'Selected portrait is unavailable.', 'HAIR_SCAN_NOT_READY');
    const designs = await query<Row>(
      `INSERT INTO client_hair_designs
        (client_id,style_name,style_category,description,is_saved,ai_status,source_asset_key)
       VALUES ($1,$2,$3,$4,true,'queued',$5) RETURNING *`,
      [clientId, input.styleName, input.styleCategory, input.description ?? null, sourceKey],
      executor,
    );
    const design = designs[0] as Row;
    const generationId = randomUUID();
    const prompt = buildHairEditPrompt(input);
    await query(
      `INSERT INTO hair_design_generations
        (id,design_id,scan_session_id,provider,model,status,prompt_version,prompt_text,idempotency_key)
       VALUES ($1,$2,$3,$4,$5,'QUEUED',$6,$7,$8)`,
      [
        generationId,
        design.id,
        input.scanId,
        env.AI_PROVIDER,
        GENERATION_MODEL,
        HAIR_PROMPT_VERSION,
        prompt,
        input.idempotencyKey,
      ],
      executor,
    );
    const updated = await query<Row>(
      'UPDATE client_hair_designs SET current_generation_id=$1 WHERE id=$2 RETURNING *',
      [generationId, design.id],
      executor,
    );
    const updatedDesign = updated[0] as Row;
    return {
      design: {
        ...updatedDesign,
        generation_status: 'QUEUED',
        progress: 0,
        provider: env.AI_PROVIDER,
        model: GENERATION_MODEL,
      },
      generationId,
      sourceKey,
      prompt,
    };
  });
  if (result.generationId !== null && result.sourceKey !== null && result.prompt !== null) {
    try {
      const queued = await enqueueAiGeneration({
        generationId: result.generationId,
        inputUrl: await createPresignedDownloadUrl(result.sourceKey),
        prompt: result.prompt,
        editRegion: editRegion(input.styleCategory),
      });
      await query(`UPDATE hair_design_generations SET python_job_id=$1,progress=5 WHERE id=$2`, [
        queued.jobId,
        result.generationId,
      ]);
    } catch (error) {
      await failAiGeneration(result.generationId, {
        errorCode: 'AI_SERVICE_UNAVAILABLE',
        errorMessage: error instanceof Error ? error.message : 'AI service unavailable.',
      });
    }
  }
  return getHairDesign(clientId, String((result.design as Row).id));
};

export const getHairDesign = async (clientId: string, designId: string) =>
  mapDesign(await getOwnedDesignRow(clientId, designId));

export const listGeneratedHairDesigns = async (clientId: string) => {
  const rows = await query<Row>(
    `SELECT d.*,g.status AS generation_status,g.progress,g.provider,g.model,
      g.error_code AS generation_error_code,g.error_message AS generation_error_message
     FROM client_hair_designs d LEFT JOIN hair_design_generations g ON g.id=d.current_generation_id
     WHERE d.client_id=$1 AND d.is_saved=true AND d.deleted_at IS NULL ORDER BY d.created_at DESC`,
    [clientId],
  );
  return { designs: await Promise.all(rows.map(mapDesign)) };
};

export const retryHairDesign = async (
  clientId: string,
  designId: string,
  input: RetryHairDesignRequest,
) => {
  requireAiEnabled();
  const result = await withTransaction(async (executor) => {
    const duplicate = await query<Row>(
      `SELECT g.id FROM hair_design_generations g
       JOIN client_hair_designs d ON d.id=g.design_id
       WHERE g.idempotency_key=$1 AND d.client_id=$2`,
      [input.idempotencyKey, clientId],
      executor,
    );
    if (duplicate[0] !== undefined)
      return { generationId: null, sourceKey: null, prompt: null, styleCategory: null };

    const design = await getOwnedDesignRow(clientId, designId, executor);
    if (!['FAILED', 'CANCELLED'].includes(String(design.generation_status))) {
      throw new AppError(409, 'Only failed previews can be retried.', 'AI_RETRY_NOT_ALLOWED');
    }
    await assertGenerationAllowance(clientId, executor);
    const previousGenerationId = String(design.current_generation_id);
    const previous = await query<Row>(
      'SELECT scan_session_id FROM hair_design_generations WHERE id=$1',
      [previousGenerationId],
      executor,
    );
    const scanId = String(previous[0]?.scan_session_id ?? '');
    const sourceKey = String(design.source_asset_key ?? '');
    if (scanId === '' || sourceKey === '') {
      throw new AppError(409, 'The original portrait is no longer available.', 'AI_RETRY_EXPIRED');
    }
    const generationId = randomUUID();
    const retryInput: GenerateHairDesignRequest = {
      scanId,
      styleName: String(design.style_name),
      styleCategory: design.style_category as GenerateHairDesignRequest['styleCategory'],
      ...(typeof design.description === 'string' ? { description: design.description } : {}),
      idempotencyKey: input.idempotencyKey,
    };
    const prompt = buildHairEditPrompt(retryInput);
    await query(
      `INSERT INTO hair_design_generations
        (id,design_id,scan_session_id,provider,model,status,prompt_version,prompt_text,
         idempotency_key,retry_of_id)
       VALUES ($1,$2,$3,$4,$5,'QUEUED',$6,$7,$8,$9)`,
      [
        generationId,
        designId,
        scanId,
        env.AI_PROVIDER,
        GENERATION_MODEL,
        HAIR_PROMPT_VERSION,
        prompt,
        input.idempotencyKey,
        previousGenerationId,
      ],
      executor,
    );
    await query(
      `UPDATE client_hair_designs SET current_generation_id=$1,ai_status='queued',
        ai_error_code=NULL,ai_error_message=NULL WHERE id=$2 AND client_id=$3`,
      [generationId, designId, clientId],
      executor,
    );
    return { generationId, sourceKey, prompt, styleCategory: retryInput.styleCategory };
  });
  if (result.generationId !== null && result.sourceKey !== null && result.prompt !== null) {
    try {
      const queued = await enqueueAiGeneration({
        generationId: result.generationId,
        inputUrl: await createPresignedDownloadUrl(result.sourceKey),
        prompt: result.prompt,
        editRegion: editRegion(result.styleCategory),
      });
      await query('UPDATE hair_design_generations SET python_job_id=$1,progress=5 WHERE id=$2', [
        queued.jobId,
        result.generationId,
      ]);
    } catch (error) {
      await failAiGeneration(result.generationId, {
        errorCode: 'AI_SERVICE_UNAVAILABLE',
        errorMessage: error instanceof Error ? error.message : 'AI service unavailable.',
      });
    }
  }
  return getHairDesign(clientId, designId);
};

export const completeAiGeneration = async (
  generationId: string,
  input: {
    outputUrl: string;
    providerRequestId: string;
    durationMs: number;
    estimatedCostCents: number;
  },
) => {
  const rows = await query<Row>(
    `SELECT g.*,d.client_id,d.id AS hair_design_id,d.source_asset_key FROM hair_design_generations g
     JOIN client_hair_designs d ON d.id=g.design_id WHERE g.id=$1`,
    [generationId],
  );
  const generation = rows[0];
  if (generation === undefined)
    throw new AppError(404, 'Generation not found.', 'AI_JOB_NOT_FOUND');
  if (generation.status === 'COMPLETED') return { accepted: true, duplicate: true };
  if (!['QUEUED', 'PROCESSING'].includes(String(generation.status))) return { accepted: false };
  await query(
    `UPDATE hair_design_generations
     SET status='PROCESSING',progress=GREATEST(progress,85)
     WHERE id=$1 AND status IN ('QUEUED','PROCESSING')`,
    [generationId],
  );
  const providerImage = await downloadRemoteImage(input.outputUrl);
  const outputKey = `hair-designs/${String(generation.client_id)}/${String(generation.hair_design_id)}/${generationId}.${extensionFromContentType(providerImage.contentType)}`;
  const stored = await storeImageBuffer(outputKey, providerImage);
  await query(
    `UPDATE hair_design_generations SET progress=GREATEST(progress,92)
     WHERE id=$1 AND status='PROCESSING'`,
    [generationId],
  );
  let sourceCloudinary: CloudinaryImage | null = null;
  let generatedCloudinary: CloudinaryImage | null = null;
  let cloudinarySyncError: string | null = null;
  if (isCloudinaryEnabled() && typeof generation.source_asset_key === 'string') {
    try {
      const sourceImage = await downloadRemoteImage(
        await createPresignedDownloadUrl(generation.source_asset_key),
      );
      [sourceCloudinary, generatedCloudinary] = await Promise.all([
        storePrivateCloudinaryImage(
          sourceImage,
          `users/${String(generation.client_id)}/looks/${String(generation.hair_design_id)}/original`,
        ),
        storePrivateCloudinaryImage(
          providerImage,
          `users/${String(generation.client_id)}/looks/${String(generation.hair_design_id)}/preview`,
        ),
      ]);
    } catch (error) {
      cloudinarySyncError =
        error instanceof Error ? error.message.slice(0, 500) : 'Cloudinary upload failed.';
    }
  }
  await saveDebugArtifacts({
    clientId: String(generation.client_id),
    designId: String(generation.hair_design_id),
    generationId,
    sourceAssetKey:
      typeof generation.source_asset_key === 'string' ? generation.source_asset_key : null,
    providerOutputUrl: input.outputUrl,
    providerImage,
    storedOutputKey: outputKey,
  }).catch(() => undefined);
  await query(
    `UPDATE hair_design_generations SET progress=GREATEST(progress,97)
     WHERE id=$1 AND status='PROCESSING'`,
    [generationId],
  );
  await withTransaction(async (executor) => {
    await query(
      `UPDATE hair_design_generations SET status='COMPLETED',progress=100,provider_request_id=$1,
        output_object_key=$2,output_mime_type=$3,estimated_cost_cents=$4,generation_duration_ms=$5,
        completed_at=CURRENT_TIMESTAMP,callback_received_at=CURRENT_TIMESTAMP,error_code=NULL,error_message=NULL
       WHERE id=$6 AND status IN ('QUEUED','PROCESSING')`,
      [
        input.providerRequestId,
        outputKey,
        stored.contentType,
        input.estimatedCostCents,
        input.durationMs,
        generationId,
      ],
      executor,
    );
    await query(
      `UPDATE client_hair_designs SET ai_status='completed',generated_asset_key=$1,
        source_cloudinary_public_id=$2,source_cloudinary_version=$3,source_cloudinary_format=$4,
        generated_cloudinary_public_id=$5,generated_cloudinary_version=$6,
        generated_cloudinary_format=$7,ai_error_code=NULL,ai_error_message=NULL
       WHERE id=$8 AND current_generation_id=$9`,
      [
        outputKey,
        sourceCloudinary?.publicId ?? null,
        sourceCloudinary?.version ?? null,
        sourceCloudinary?.format ?? null,
        generatedCloudinary?.publicId ?? null,
        generatedCloudinary?.version ?? null,
        generatedCloudinary?.format ?? null,
        generation.hair_design_id,
        generationId,
      ],
      executor,
    );
    await query(
      `INSERT INTO ai_usage_events
        (client_id,generation_id,provider,model,event_type,output_units,estimated_cost_cents,metadata)
       VALUES ($1,$2,$3,$4,'IMAGE_GENERATED',1,$5,$6)`,
      [
        generation.client_id,
        generationId,
        generation.provider,
        generation.model,
        input.estimatedCostCents,
        JSON.stringify({
          durationMs: input.durationMs,
          sizeBytes: stored.sizeBytes,
          imageStorage: generatedCloudinary === null ? 'private-object-storage' : 'cloudinary',
          cloudinarySyncError,
        }),
      ],
      executor,
    );
  });
  return { accepted: true, duplicate: false };
};

export const startAiGeneration = async (generationId: string) => {
  const rows = await query<Row>(
    `UPDATE hair_design_generations
     SET status='PROCESSING',progress=15,started_at=COALESCE(started_at,CURRENT_TIMESTAMP),
       provider_submitted_at=COALESCE(provider_submitted_at,CURRENT_TIMESTAMP)
     WHERE id=$1 AND status='QUEUED' RETURNING design_id`,
    [generationId],
  );
  if (rows[0] !== undefined) {
    await query(
      `UPDATE client_hair_designs SET ai_status='processing'
       WHERE id=$1 AND current_generation_id=$2`,
      [rows[0].design_id, generationId],
    );
    return { accepted: true, duplicate: false };
  }
  const existing = await query<Row>('SELECT status FROM hair_design_generations WHERE id=$1', [
    generationId,
  ]);
  if (existing[0] === undefined)
    throw new AppError(404, 'Generation not found.', 'AI_JOB_NOT_FOUND');
  return { accepted: existing[0].status === 'PROCESSING', duplicate: true };
};

export const updateAiGenerationProgress = async (generationId: string, progress: number) => {
  const rows = await query<Row>(
    `UPDATE hair_design_generations
     SET progress=GREATEST(progress,$1)
     WHERE id=$2 AND status='PROCESSING'
     RETURNING progress`,
    [progress, generationId],
  );
  if (rows[0] !== undefined) {
    return { accepted: true, progress: Number(rows[0].progress) };
  }
  const existing = await query<Row>(
    'SELECT status,progress FROM hair_design_generations WHERE id=$1',
    [generationId],
  );
  if (existing[0] === undefined) {
    throw new AppError(404, 'Generation not found.', 'AI_JOB_NOT_FOUND');
  }
  return {
    accepted: existing[0].status === 'COMPLETED',
    progress: Number(existing[0].progress),
  };
};

export const failAiGeneration = async (
  generationId: string,
  input: { errorCode: string; errorMessage: string },
) => {
  const rows = await query<Row>(
    `UPDATE hair_design_generations SET status='FAILED',progress=100,error_code=$1,error_message=$2,
      failed_at=CURRENT_TIMESTAMP,callback_received_at=CURRENT_TIMESTAMP
     WHERE id=$3 AND status IN ('QUEUED','PROCESSING') RETURNING design_id`,
    [input.errorCode, input.errorMessage.slice(0, 1000), generationId],
  );
  if (rows[0] !== undefined) {
    await query(
      `UPDATE client_hair_designs SET ai_status='failed',ai_error_code=$1,ai_error_message=$2
       WHERE id=$3 AND current_generation_id=$4`,
      [input.errorCode, input.errorMessage.slice(0, 1000), rows[0].design_id, generationId],
    );
  }
  return { accepted: true };
};

export const deleteHairDesign = async (clientId: string, designId: string) => {
  const design = await getOwnedDesignRow(clientId, designId);
  await withTransaction(async (executor) => {
    await query(
      'UPDATE appointments SET style_reference_id=NULL WHERE style_reference_id=$1 AND client_id=$2',
      [designId, clientId],
      executor,
    );
    await query(
      `UPDATE hair_design_generations SET status='CANCELLED' WHERE design_id=$1 AND status IN ('QUEUED','PROCESSING')`,
      [designId],
      executor,
    );
    await query(
      `UPDATE client_hair_designs SET is_saved=false,deleted_at=CURRENT_TIMESTAMP,
        ai_status='cancelled',generated_asset_key=NULL WHERE id=$1 AND client_id=$2`,
      [designId, clientId],
      executor,
    );
  });
  if (typeof design.generated_asset_key === 'string') {
    await deleteStoredObject(design.generated_asset_key).catch(() => undefined);
  }
  await Promise.all(
    [design.source_cloudinary_public_id, design.generated_cloudinary_public_id]
      .filter((publicId): publicId is string => typeof publicId === 'string')
      .map((publicId) => deletePrivateCloudinaryImage(publicId).catch(() => undefined)),
  );
  return { message: 'Hair design deleted.' };
};

export const maintainHairStudio = async (): Promise<{
  expiredScans: number;
  failedGenerations: number;
}> => {
  const expiredCaptures = await query<Row>(
    `SELECT c.object_key FROM hair_scan_captures c
     JOIN hair_scan_sessions s ON s.id=c.scan_session_id
     WHERE s.expires_at <= CURRENT_TIMESTAMP AND s.status NOT IN ('EXPIRED','DELETED')`,
  );
  await Promise.all(
    expiredCaptures.map((capture) =>
      deleteStoredObject(String(capture.object_key)).catch(() => undefined),
    ),
  );
  const expired = await query<Row>(
    `UPDATE hair_scan_sessions SET status='EXPIRED'
     WHERE expires_at <= CURRENT_TIMESTAMP AND status NOT IN ('EXPIRED','DELETED') RETURNING id`,
  );
  const stale = await query<Row>(
    `UPDATE hair_design_generations
     SET status='FAILED',progress=100,error_code='AI_JOB_STALE',
       error_message='Generation timed out before receiving a worker callback.',failed_at=CURRENT_TIMESTAMP
     WHERE (status='QUEUED' AND created_at < CURRENT_TIMESTAMP - interval '2 minutes')
        OR (status='PROCESSING' AND started_at < CURRENT_TIMESTAMP - interval '5 minutes')
     RETURNING id,design_id`,
  );
  for (const generation of stale) {
    await query(
      `UPDATE client_hair_designs SET ai_status='failed',ai_error_code='AI_JOB_STALE',
        ai_error_message='Generation timed out. Please retry.'
       WHERE id=$1 AND current_generation_id=$2`,
      [generation.design_id, generation.id],
    );
  }
  return { expiredScans: expired.length, failedGenerations: stale.length };
};
