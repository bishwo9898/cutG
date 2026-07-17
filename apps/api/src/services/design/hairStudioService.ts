/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { randomUUID } from 'node:crypto';

import type {
  CompleteHairCaptureRequest,
  CompleteHairScanRequest,
  CreateHairScanRequest,
  GenerateHairDesignRequest,
  HairScanAngle,
  PresignHairCaptureRequest,
  RetryHairDesignRequest,
} from '@barber-saas/shared-types';

import { env } from '../../config/env';
import { query, withTransaction, type DatabaseExecutor } from '../../db/queries/barber.queries';
import { AppError } from '../../middleware/errorHandler';
import {
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  deleteStoredObject,
  verifyUploadedObject,
} from '../storage/objectStorage';

import { enqueueHairStudioJob } from './hairStudioQueue';

type Row = Record<string, unknown>;
const PROMPT_VERSION = 'hair-edit-v1';
const iso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();

const requireAiEnabled = (): void => {
  if (!env.ENABLE_AI_FEATURES) {
    throw new AppError(503, 'AI Hair Studio is temporarily unavailable.', 'AI_DISABLED');
  }
  if (env.AI_PROVIDER === 'gemini' && env.GEMINI_API_KEY.trim() === '') {
    throw new AppError(503, 'AI Hair Studio is not configured.', 'AI_NOT_CONFIGURED');
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

const mapDesign = async (row: Row) => ({
  id: row.id,
  styleName: row.style_name,
  styleCategory: row.style_category,
  description: row.description,
  sourcePhotoUrl: null,
  generatedPreviewUrl:
    typeof row.generated_asset_key === 'string'
      ? await createPresignedDownloadUrl(row.generated_asset_key)
      : null,
  aiStatus: row.ai_status,
  generationStatus: row.generation_status ?? null,
  progress: Number(row.progress ?? (row.ai_status === 'completed' ? 100 : 0)),
  provider: row.provider ?? null,
  model: row.model ?? null,
  errorCode: row.generation_error_code ?? row.ai_error_code ?? null,
  errorMessage: row.generation_error_message ?? row.ai_error_message ?? null,
  appointmentId: row.appointment_id,
  createdAt: iso(row.created_at),
});

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
    expiresAt: iso(row.expires_at),
    createdAt: iso(row.created_at),
  };
};

const assertGenerationAllowance = async (
  clientId: string,
  executor: DatabaseExecutor,
): Promise<void> => {
  const active = await query<Row>(
    `SELECT 1 FROM hair_design_generations g
     JOIN client_hair_designs d ON d.id=g.design_id
     WHERE d.client_id=$1 AND g.status IN ('QUEUED','PROCESSING') LIMIT 1`,
    [clientId],
    executor,
  );
  if (active.length > 0) {
    throw new AppError(409, 'Finish the current preview before starting another.', 'AI_JOB_ACTIVE');
  }

  const daily = await query<Row>(
    `SELECT COUNT(*)::int AS count FROM hair_design_generations g
     JOIN client_hair_designs d ON d.id=g.design_id
     WHERE d.client_id=$1 AND g.created_at >= CURRENT_TIMESTAMP - interval '24 hours'`,
    [clientId],
    executor,
  );
  if (Number(daily[0]?.count ?? 0) >= env.AI_GENERATION_DAILY_LIMIT) {
    throw new AppError(429, 'Daily AI preview limit reached.', 'AI_DAILY_LIMIT');
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
  enabled:
    env.ENABLE_AI_FEATURES && (env.AI_PROVIDER === 'mock' || env.GEMINI_API_KEY.trim() !== ''),
  provider: env.AI_PROVIDER === 'mock' ? 'demo' : 'gemini',
  consentVersion: '2026-07-16',
  requiredAngles: ['FRONT', 'LEFT', 'RIGHT'] as HairScanAngle[],
  maxCaptureBytes: 3_000_000,
  retentionHours: env.AI_SCAN_RETENTION_HOURS,
  dailyGenerationLimit: env.AI_GENERATION_DAILY_LIMIT,
  isMock: env.AI_PROVIDER === 'mock',
});

export const createHairScan = async (clientId: string, input: CreateHairScanRequest) => {
  requireAiEnabled();
  const expiresAt = new Date(Date.now() + env.AI_SCAN_RETENTION_HOURS * 60 * 60 * 1000);
  const rows = await query<Row>(
    `INSERT INTO hair_scan_sessions
      (client_id,consent_version,age_confirmed,expires_at)
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
  const extension = input.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const objectKey =
    typeof existing[0]?.object_key === 'string'
      ? existing[0].object_key
      : `hair-scans/${clientId}/${scanId}/${input.angle.toLowerCase()}-${captureId}.${extension}`;

  await query(
    `INSERT INTO hair_scan_captures
      (id,scan_session_id,angle,object_key,mime_type,size_bytes,checksum_sha256,delete_after)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (scan_session_id,angle) DO UPDATE SET
       mime_type=EXCLUDED.mime_type,size_bytes=EXCLUDED.size_bytes,
       checksum_sha256=EXCLUDED.checksum_sha256,upload_status='PENDING',
       width=NULL,height=NULL,brightness=NULL,sharpness=NULL,face_count=NULL,pose_score=NULL`,
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
      brightness=$3,sharpness=$4,face_count=$5,pose_score=$6
     WHERE id=$7 RETURNING *`,
    [
      input.width,
      input.height,
      input.brightness,
      input.sharpness,
      input.faceCount,
      input.poseScore,
      captureId,
    ],
  );
  return mapCapture(rows[0] as Row);
};

export const completeHairScan = async (
  clientId: string,
  scanId: string,
  input: CompleteHairScanRequest,
) => {
  requireAiEnabled();
  const scan = await getOwnedScan(clientId, scanId);
  if (scan.status !== 'CAPTURING') {
    throw new AppError(409, 'This scan has already been completed.', 'HAIR_SCAN_CLOSED');
  }
  const captures = await query<Row>(
    `SELECT angle FROM hair_scan_captures
     WHERE scan_session_id=$1 AND upload_status='VERIFIED'`,
    [scanId],
  );
  const angles = new Set(captures.map((capture) => capture.angle));
  if (!['FRONT', 'LEFT', 'RIGHT'].every((angle) => angles.has(angle))) {
    throw new AppError(
      422,
      'Front, left, and right captures are required.',
      'HAIR_SCAN_INCOMPLETE',
    );
  }
  const rows = await query<Row>(
    `UPDATE hair_scan_sessions SET status='READY',analysis_status='QUEUED',preferences=$1
     WHERE id=$2 AND client_id=$3 RETURNING *`,
    [JSON.stringify(input.preferences), scanId, clientId],
  );
  await enqueueHairStudioJob({ kind: 'ANALYZE_SCAN', scanId, clientId });
  return mapScan(rows[0] as Row);
};

export const generateHairDesign = async (clientId: string, input: GenerateHairDesignRequest) => {
  requireAiEnabled();
  const result = await withTransaction(async (executor) => {
    const scan = await getOwnedScan(clientId, input.scanId, executor);
    if (scan.status !== 'READY') {
      throw new AppError(409, 'Complete the three-angle scan first.', 'HAIR_SCAN_NOT_READY');
    }
    const duplicate = await query<Row>(
      `SELECT d.*,g.status AS generation_status,g.progress,g.provider,g.model,
        g.error_code AS generation_error_code,g.error_message AS generation_error_message
       FROM hair_design_generations g JOIN client_hair_designs d ON d.id=g.design_id
       WHERE g.idempotency_key=$1 AND d.client_id=$2`,
      [input.idempotencyKey, clientId],
      executor,
    );
    if (duplicate[0] !== undefined) return { design: duplicate[0], generationId: null };

    await assertGenerationAllowance(clientId, executor);

    const designs = await query<Row>(
      `INSERT INTO client_hair_designs
        (client_id,style_name,style_category,description,is_saved,ai_status)
       VALUES ($1,$2,$3,$4,true,'queued') RETURNING *`,
      [clientId, input.styleName, input.styleCategory, input.description ?? null],
      executor,
    );
    const design = designs[0] as Row;
    const generationId = randomUUID();
    const model = env.AI_PROVIDER === 'mock' ? 'cutg-mock-v1' : env.GEMINI_IMAGE_MODEL;
    await query(
      `INSERT INTO hair_design_generations
        (id,design_id,scan_session_id,provider,model,status,prompt_version,idempotency_key)
       VALUES ($1,$2,$3,$4,$5,'QUEUED',$6,$7)`,
      [
        generationId,
        design.id,
        input.scanId,
        env.AI_PROVIDER,
        model,
        PROMPT_VERSION,
        input.idempotencyKey,
      ],
      executor,
    );
    const updated = await query<Row>(
      `UPDATE client_hair_designs SET current_generation_id=$1 WHERE id=$2 RETURNING *`,
      [generationId, design.id],
      executor,
    );
    return {
      design: {
        ...updated[0],
        generation_status: 'QUEUED',
        progress: 0,
        provider: env.AI_PROVIDER,
        model,
      },
      generationId,
    };
  });

  if (result.generationId !== null) {
    await enqueueHairStudioJob({
      kind: 'GENERATE_DESIGN',
      generationId: result.generationId,
      clientId,
    });
  }
  return mapDesign(result.design);
};

export const getHairDesign = async (clientId: string, designId: string) =>
  mapDesign(await getOwnedDesignRow(clientId, designId));

export const listGeneratedHairDesigns = async (clientId: string) => {
  const rows = await query<Row>(
    `SELECT d.*,g.status AS generation_status,g.progress,g.provider,g.model,
      g.error_code AS generation_error_code,g.error_message AS generation_error_message
     FROM client_hair_designs d
     LEFT JOIN hair_design_generations g ON g.id=d.current_generation_id
     WHERE d.client_id=$1 AND d.is_saved=true AND d.deleted_at IS NULL
     ORDER BY d.created_at DESC`,
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
    const design = await getOwnedDesignRow(clientId, designId, executor);
    if (!['FAILED', 'CANCELLED'].includes(String(design.generation_status))) {
      throw new AppError(409, 'Only failed previews can be retried.', 'AI_RETRY_NOT_ALLOWED');
    }
    await assertGenerationAllowance(clientId, executor);
    const duplicate = await query<Row>(
      'SELECT id FROM hair_design_generations WHERE idempotency_key=$1',
      [input.idempotencyKey],
      executor,
    );
    if (duplicate.length > 0) {
      throw new AppError(409, 'This retry was already submitted.', 'AI_DUPLICATE_REQUEST');
    }
    const generationId = randomUUID();
    const model = env.AI_PROVIDER === 'mock' ? 'cutg-mock-v1' : env.GEMINI_IMAGE_MODEL;
    await query(
      `INSERT INTO hair_design_generations
        (id,design_id,scan_session_id,provider,model,status,prompt_version,idempotency_key,retry_of_id)
       SELECT $1,design_id,scan_session_id,$2,$3,'QUEUED',$4,$5,id
       FROM hair_design_generations WHERE id=$6`,
      [
        generationId,
        env.AI_PROVIDER,
        model,
        PROMPT_VERSION,
        input.idempotencyKey,
        design.current_generation_id,
      ],
      executor,
    );
    await query(
      `UPDATE client_hair_designs SET current_generation_id=$1,ai_status='queued',
        ai_error_code=NULL,ai_error_message=NULL WHERE id=$2`,
      [generationId, designId],
      executor,
    );
    return generationId;
  });
  await enqueueHairStudioJob({ kind: 'GENERATE_DESIGN', generationId: result, clientId });
  return getHairDesign(clientId, designId);
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
      `UPDATE hair_design_generations SET status='CANCELLED'
       WHERE design_id=$1 AND status IN ('QUEUED','PROCESSING')`,
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
  return { message: 'Hair design deleted.' };
};
