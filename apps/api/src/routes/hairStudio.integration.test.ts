import { randomUUID } from 'node:crypto';

import type { HairPreferences } from '@barber-saas/shared-types';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { app } from '../app';
import { closeDatabase, pool } from '../config/database';
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

afterAll(async () => closeDatabase());

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

    const hidden = await request(app)
      .get(`/clients/me/hair-scans/${scanId}`)
      .set('Authorization', `Bearer ${otherClientToken}`);
    expect(hidden.status).toBe(404);
  });

  it('completes three verified angles and queues analysis exactly once', async () => {
    for (const angle of ['FRONT', 'LEFT', 'RIGHT']) {
      await pool.query(
        `INSERT INTO hair_scan_captures
          (scan_session_id,angle,object_key,mime_type,size_bytes,checksum_sha256,width,height,
           brightness,sharpness,face_count,pose_score,upload_status,delete_after)
         SELECT id,$1,$2,'image/jpeg',20000,$3,900,1200,110,12,1,0.95,'VERIFIED',expires_at
         FROM hair_scan_sessions WHERE id=$4`,
        [angle, `test/${scanId}/${angle}.jpg`, 'a'.repeat(64), scanId],
      );
    }
    const completed = await request(app)
      .post(`/clients/me/hair-scans/${scanId}/complete`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ preferences: preferences() });
    expect(completed.status).toBe(202);
    expect(completed.body).toMatchObject({ status: 'READY', analysisStatus: 'QUEUED' });

    const duplicate = await request(app)
      .post(`/clients/me/hair-scans/${scanId}/complete`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ preferences: preferences() });
    expect(duplicate.status).toBe(409);

    await pool.query(
      `UPDATE hair_scan_sessions SET analysis_status='COMPLETED',suggestions=$1 WHERE id=$2`,
      [
        JSON.stringify([
          {
            id: 'textured-crop',
            name: 'Textured Crop',
            category: 'haircut',
            description: 'Short texture with a clean taper.',
            reason: 'Fits a low-maintenance routine.',
          },
        ]),
        scanId,
      ],
    );
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
});

const preferences = (): HairPreferences => ({
  desiredLength: 'short',
  maintenance: 'low',
  texture: 'natural',
  fadePreference: 'low',
  overallStyle: 'clean',
});
