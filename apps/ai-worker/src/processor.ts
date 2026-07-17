import { randomUUID } from 'node:crypto';

import type { HairPreferences, HairStudioJob } from '@barber-saas/shared-types';
import type { Job } from 'bullmq';

import { config } from './config';
import { query, transaction } from './database';
import { createProvider, type CaptureInput } from './provider';
import { deleteObject, readObject, writeObject } from './storage';

type Row = Record<string, unknown>;
const provider = createProvider();

const captureInputs = async (scanId: string): Promise<CaptureInput[]> => {
  const rows = await query<Row>(
    `SELECT angle,object_key,mime_type FROM hair_scan_captures
     WHERE scan_session_id=$1 AND upload_status='VERIFIED'
     ORDER BY CASE angle WHEN 'FRONT' THEN 1 WHEN 'LEFT' THEN 2 ELSE 3 END`,
    [scanId],
  );
  return Promise.all(
    rows.map(async (row) => ({
      angle: String(row.angle),
      mimeType: String(row.mime_type),
      bytes: await readObject(String(row.object_key)),
    })),
  );
};

const safeError = (error: unknown): { code: string; message: string } => {
  const message = error instanceof Error ? error.message : 'Unknown AI provider failure.';
  if (message === 'MOCK_PROVIDER_FAILURE') {
    return {
      code: 'MOCK_PROVIDER_FAILURE',
      message: 'The demo provider was asked to simulate a failure.',
    };
  }
  if (/safety|blocked|policy/i.test(message)) {
    return {
      code: 'PROVIDER_SAFETY_BLOCK',
      message: 'The provider could not process these captures.',
    };
  }
  if (/quota|rate|429/i.test(message)) {
    return {
      code: 'PROVIDER_RATE_LIMIT',
      message: 'The AI provider is busy. Please retry shortly.',
    };
  }
  return { code: 'PROVIDER_ERROR', message: 'The AI preview could not be created. Please retry.' };
};

const analyzeScan = async (job: Job<HairStudioJob>, scanId: string): Promise<void> => {
  const started = await query<Row>(
    `UPDATE hair_scan_sessions SET analysis_status='PROCESSING',analysis_error=NULL
     WHERE id=$1 AND status='READY' AND analysis_status='QUEUED' RETURNING preferences`,
    [scanId],
  );
  if (started.length === 0) return;
  await job.updateProgress(20);
  try {
    const captures = await captureInputs(scanId);
    await job.updateProgress(55);
    const result = await provider.suggest(captures, started[0]?.preferences as HairPreferences);
    await query(
      `UPDATE hair_scan_sessions SET analysis_status='COMPLETED',suggestions=$1,analysis_error=NULL
       WHERE id=$2`,
      [JSON.stringify(result.suggestions), scanId],
    );
    await job.updateProgress(100);
  } catch (error) {
    const mapped = safeError(error);
    await query(
      `UPDATE hair_scan_sessions SET analysis_status='FAILED',analysis_error=$1 WHERE id=$2`,
      [mapped.message, scanId],
    );
    throw error;
  }
};

const generateDesign = async (
  job: Job<HairStudioJob>,
  generationId: string,
  clientId: string,
): Promise<void> => {
  const rows = await query<Row>(
    `UPDATE hair_design_generations g SET status='PROCESSING',progress=10,started_at=CURRENT_TIMESTAMP,
      error_code=NULL,error_message=NULL
     FROM client_hair_designs d
     WHERE g.id=$1 AND g.design_id=d.id AND d.client_id=$2 AND g.status='QUEUED'
     RETURNING g.*,d.style_name,d.description`,
    [generationId, clientId],
  );
  const generation = rows[0];
  if (generation === undefined) return;
  await query("UPDATE client_hair_designs SET ai_status='processing' WHERE id=$1", [
    generation.design_id,
  ]);
  await job.updateProgress(10);

  try {
    const captures = await captureInputs(String(generation.scan_session_id));
    await query('UPDATE hair_design_generations SET progress=35 WHERE id=$1', [generationId]);
    await job.updateProgress(35);
    const result = await provider.generate(captures, {
      styleName: String(generation.style_name),
      description: generation.description === null ? null : String(generation.description),
    });
    await job.updateProgress(85);
    const extension =
      result.mimeType === 'image/jpeg' ? 'jpg' : result.mimeType === 'image/webp' ? 'webp' : 'png';
    const outputKey = `hair-designs/${clientId}/${String(generation.design_id)}/${generationId}.${extension}`;
    await writeObject(outputKey, result.image, result.mimeType);

    const persisted = await transaction(async (client) => {
      const completed = await query<Row>(
        `UPDATE hair_design_generations SET status='COMPLETED',progress=100,
          provider_request_id=$1,output_object_key=$2,output_mime_type=$3,usage=$4,
          estimated_cost_cents=$5,completed_at=CURRENT_TIMESTAMP
         WHERE id=$6 AND status='PROCESSING' RETURNING design_id`,
        [
          result.requestId,
          outputKey,
          result.mimeType,
          JSON.stringify(result.usage.raw),
          result.estimatedCostCents,
          generationId,
        ],
        client,
      );
      if (completed.length === 0) return false;
      await query(
        `UPDATE client_hair_designs SET ai_status='completed',generated_asset_key=$1,
          generated_preview_url=NULL,ai_error_code=NULL,ai_error_message=NULL WHERE id=$2`,
        [outputKey, generation.design_id],
        client,
      );
      await query(
        `INSERT INTO ai_usage_events
          (id,client_id,generation_id,provider,model,event_type,input_units,output_units,
           estimated_cost_cents,metadata)
         VALUES ($1,$2,$3,$4,$5,'IMAGE_GENERATION',$6,$7,$8,$9)`,
        [
          randomUUID(),
          clientId,
          generationId,
          config.provider,
          generation.model,
          result.usage.inputUnits,
          result.usage.outputUnits,
          result.estimatedCostCents,
          JSON.stringify({ promptVersion: generation.prompt_version, latencyRecorded: true }),
        ],
        client,
      );
      return true;
    });
    if (!persisted) await deleteObject(outputKey).catch(() => undefined);
    await job.updateProgress(100);
  } catch (error) {
    const mapped = safeError(error);
    await transaction(async (client) => {
      await query(
        `UPDATE hair_design_generations SET status='FAILED',progress=100,error_code=$1,
          error_message=$2,failed_at=CURRENT_TIMESTAMP WHERE id=$3 AND status='PROCESSING'`,
        [mapped.code, mapped.message, generationId],
        client,
      );
      await query(
        `UPDATE client_hair_designs SET ai_status='failed',ai_error_code=$1,ai_error_message=$2
         WHERE id=$3 AND current_generation_id=$4`,
        [mapped.code, mapped.message, generation.design_id, generationId],
        client,
      );
    });
    throw error;
  }
};

export const processHairStudioJob = async (job: Job<HairStudioJob>): Promise<void> => {
  if (job.data.kind === 'ANALYZE_SCAN') {
    await analyzeScan(job, job.data.scanId);
    return;
  }
  await generateDesign(job, job.data.generationId, job.data.clientId);
};

export const cleanupExpiredScans = async (): Promise<number> => {
  const captures = await query<Row>(
    `SELECT c.object_key FROM hair_scan_captures c JOIN hair_scan_sessions s ON s.id=c.scan_session_id
     WHERE c.delete_after <= CURRENT_TIMESTAMP AND s.status <> 'DELETED'`,
  );
  await Promise.all(
    captures.map((row) => deleteObject(String(row.object_key)).catch(() => undefined)),
  );
  await query(`DELETE FROM hair_scan_captures WHERE delete_after <= CURRENT_TIMESTAMP`);
  const expired = await query<Row>(
    `UPDATE hair_scan_sessions SET status='EXPIRED',analysis_status='NOT_STARTED'
     WHERE expires_at <= CURRENT_TIMESTAMP AND status NOT IN ('EXPIRED','DELETED') RETURNING id`,
  );
  return expired.length;
};
