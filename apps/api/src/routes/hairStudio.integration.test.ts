import { randomUUID } from 'node:crypto';

import type { HairPreferences } from '@barber-saas/shared-types';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { app } from '../app';
import { closeDatabase, pool } from '../config/database';
import { env } from '../config/env';
import { createVerifiedUser, resetTestDatabase } from '../test/fixtures';

let clientToken = '';
let otherClientToken = '';
let clientId = '';
let scanId = '';
let designId = '';

type LoginBody = { accessToken: string };
type ScanBody = { id: string; status: string; analysisStatus: string; captures: unknown[] };
type DesignBody = { id: string; generationStatus: string; generatedPreviewUrl: string | null };

beforeAll(async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      await Promise.resolve();
      const url = String(input);
      if (url.endsWith('/ai/validate-frames')) {
        expect(new Headers(init?.headers).get('X-CutG-AI-Secret')).toBe(env.AI_INTERNAL_SECRET);
        const body = JSON.parse(String(init?.body)) as {
          frames: Array<{ capture_id: string; angle: string }>;
        };
        expect(body.frames).toHaveLength(1);
        expect(body.frames[0]?.angle).toBe('FRONT');
        return new Response(
          JSON.stringify({
            selected_capture_id: body.frames[0]?.capture_id,
            metrics: body.frames.map((frame) => ({
              capture_id: frame.capture_id,
              angle: frame.angle,
              width: 900,
              height: 1200,
              brightness: 110,
              sharpness: 80,
              face_count: 1,
              face_size: 0.22,
              yaw: 0,
              hairline_visible: true,
              pose_score: 0.95,
              quality_score: 0.9,
              accepted: true,
              rejection_reason: null,
            })),
            suggestions: [
              {
                id: 'textured-crop',
                name: 'Textured Crop',
                category: 'haircut',
                description: 'Short texture with a clean taper.',
                reason: 'Fits a low-maintenance routine.',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/ai/generations')) {
        return new Response(JSON.stringify({ job_id: 'generation-test', status: 'queued' }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch in Hair Studio test: ${url}`);
    }),
  );
  await resetTestDatabase();
  const client = await createVerifiedUser('CLIENT', 'hair.studio@example.com');
  await createVerifiedUser('CLIENT', 'hair.studio.other@example.com');
  clientId = client.id;
  const login = await request(app)
    .post('/auth/login')
    .send({ email: 'hair.studio@example.com', password: 'strong-password-123' });
  const otherLogin = await request(app)
    .post('/auth/login')
    .send({ email: 'hair.studio.other@example.com', password: 'strong-password-123' });
  clientToken = (login.body as LoginBody).accessToken;
  otherClientToken = (otherLogin.body as LoginBody).accessToken;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await closeDatabase();
});

describe('AI Hair Studio API', () => {
  it('exposes a safe mock configuration and requires client authentication', async () => {
    const unauthorized = await request(app).get('/clients/me/hair-studio/config');
    expect(unauthorized.status).toBe(401);

    const response = await request(app)
      .get('/clients/me/hair-studio/config')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ enabled: true, provider: 'demo', isMock: true });
    expect(response.body).not.toHaveProperty('apiKey');
  });

  it('creates an owned scan and rejects incomplete capture sets', async () => {
    const created = await request(app)
      .post('/clients/me/hair-scans')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ consentAccepted: true, ageConfirmed: true, consentVersion: 'test-v1' });
    expect(created.status).toBe(201);
    scanId = (created.body as ScanBody).id;

    const incomplete = await request(app)
      .post(`/clients/me/hair-scans/${scanId}/complete`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ preferences: preferences() });
    expect(incomplete.status).toBe(422);
    expect(incomplete.body).toMatchObject({
      error: 'HAIR_SCAN_INCOMPLETE',
      details: { rejectedFrames: [{ angle: 'FRONT' }] },
    });

    const hidden = await request(app)
      .get(`/clients/me/hair-scans/${scanId}`)
      .set('Authorization', `Bearer ${otherClientToken}`);
    expect(hidden.status).toBe(404);
  });

  it('completes one verified headshot and validates it exactly once', async () => {
    await pool.query(
      `INSERT INTO hair_scan_captures
        (scan_session_id,angle,object_key,mime_type,size_bytes,checksum_sha256,width,height,
         brightness,sharpness,face_count,pose_score,upload_status,delete_after)
       SELECT id,'FRONT',$1,'image/jpeg',20000,$2,900,1200,110,12,1,0.95,'VERIFIED',expires_at
       FROM hair_scan_sessions WHERE id=$3`,
      [`test/${scanId}/front.jpg`, 'a'.repeat(64), scanId],
    );
    const completed = await request(app)
      .post(`/clients/me/hair-scans/${scanId}/complete`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ preferences: preferences() });
    expect(completed.status).toBe(202);
    expect(completed.body).toMatchObject({ status: 'READY', analysisStatus: 'COMPLETED' });

    const duplicate = await request(app)
      .post(`/clients/me/hair-scans/${scanId}/complete`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ preferences: preferences() });
    expect(duplicate.status).toBe(202);
    expect(duplicate.body).toMatchObject({ status: 'READY', analysisStatus: 'COMPLETED' });
  });

  it('uses idempotency before active-job limits and preserves private ownership', async () => {
    const idempotencyKey = randomUUID();
    const body = {
      scanId,
      styleName: 'Textured Crop',
      styleCategory: 'haircut',
      description: 'Keep a soft taper.',
      idempotencyKey,
    };
    const first = await request(app)
      .post('/clients/me/designs/generate')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(body);
    const repeated = await request(app)
      .post('/clients/me/designs/generate')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(body);
    expect(first.status).toBe(202);
    expect(repeated.status).toBe(202);
    designId = (first.body as DesignBody).id;
    expect((repeated.body as DesignBody).id).toBe(designId);
    expect((first.body as DesignBody).generationStatus).toBe('QUEUED');

    const hidden = await request(app)
      .get(`/clients/me/designs/${designId}`)
      .set('Authorization', `Bearer ${otherClientToken}`);
    expect(hidden.status).toBe(404);

    const secondJob = await request(app)
      .post('/clients/me/designs/generate')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ ...body, idempotencyKey: randomUUID() });
    expect(secondJob.status).toBe(409);
    expect(secondJob.body).toHaveProperty('error', 'AI_JOB_ACTIVE');
  });

  it('authenticates worker callbacks and marks a queued job as processing', async () => {
    const generation = await pool.query<{ id: string }>(
      'SELECT id FROM hair_design_generations WHERE design_id=$1',
      [designId],
    );
    const generationId = generation.rows[0]?.id ?? '';
    const denied = await request(app).post(`/internal/ai/generations/${generationId}/processing`);
    expect(denied.status).toBe(401);
    const started = await request(app)
      .post(`/internal/ai/generations/${generationId}/processing`)
      .set('X-CutG-AI-Secret', env.AI_INTERNAL_SECRET)
      .send({});
    expect(started.status).toBe(200);
    const row = await pool.query<{ status: string; progress: number }>(
      'SELECT status,progress FROM hair_design_generations WHERE id=$1',
      [generationId],
    );
    expect(row.rows[0]).toMatchObject({ status: 'PROCESSING', progress: 15 });
  });

  it('soft-deletes a design and cancels its queued generation', async () => {
    const removed = await request(app)
      .delete(`/clients/me/designs/${designId}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(removed.status).toBe(200);

    const row = await pool.query<{ status: string }>(
      `SELECT g.status FROM hair_design_generations g
       JOIN client_hair_designs d ON d.id=g.design_id
       WHERE d.id=$1 AND d.client_id=$2`,
      [designId, clientId],
    );
    expect(row.rows[0]?.status).toBe('CANCELLED');
    const missing = await request(app)
      .get(`/clients/me/designs/${designId}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(missing.status).toBe(404);
  });

  it('counts delivered previews, not failed or cancelled jobs, toward the daily limit', async () => {
    const generationIds: string[] = [];
    for (let index = 0; index < env.AI_GENERATION_DAILY_LIMIT; index += 1) {
      const design = await pool.query<{ id: string }>(
        `INSERT INTO client_hair_designs
          (client_id,style_name,style_category,ai_status,deleted_at)
         VALUES ($1,'Failed preview','haircut','failed',CURRENT_TIMESTAMP) RETURNING id`,
        [clientId],
      );
      const generationId = randomUUID();
      generationIds.push(generationId);
      await pool.query(
        `INSERT INTO hair_design_generations
          (id,design_id,scan_session_id,provider,model,status,prompt_version,idempotency_key,
           error_code,error_message,failed_at)
         VALUES ($1,$2,$3,'mock','test-model','FAILED','test-v1',$4,
           'AI_GENERATION_FAILED','Expected test failure',CURRENT_TIMESTAMP)`,
        [generationId, design.rows[0]?.id, scanId, randomUUID()],
      );
    }

    const body = {
      scanId,
      styleName: 'Textured Crop',
      styleCategory: 'haircut',
      idempotencyKey: randomUUID(),
    };
    const allowed = await request(app)
      .post('/clients/me/designs/generate')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(body);
    expect(allowed.status).toBe(202);

    await request(app)
      .delete(`/clients/me/designs/${String((allowed.body as DesignBody).id)}`)
      .set('Authorization', `Bearer ${clientToken}`);
    for (const generationId of generationIds) {
      await pool.query(
        `INSERT INTO ai_usage_events
          (client_id,generation_id,provider,model,event_type,output_units)
         VALUES ($1,$2,'mock','test-model','IMAGE_GENERATED',1)`,
        [clientId, generationId],
      );
    }

    const blocked = await request(app)
      .post('/clients/me/designs/generate')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ ...body, idempotencyKey: randomUUID() });
    expect(blocked.status).toBe(429);
    expect(blocked.body).toHaveProperty('error', 'DAILY_LIMIT_REACHED');
  });
});

const preferences = (): HairPreferences => ({
  desiredLength: 'short',
  maintenance: 'low',
  texture: 'natural',
  fadePreference: 'low',
  overallStyle: 'clean',
});
