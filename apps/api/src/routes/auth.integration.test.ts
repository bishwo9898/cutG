import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../app';
import { closeDatabase, pool } from '../config/database';
import { createVerifiedUser, resetTestDatabase } from '../test/fixtures';

type TokenBody = {
  accessToken: string;
  refreshToken: string;
};

type ProfileBody = {
  createdAt: string;
};

const registration = {
  email: 'new.barber@example.com',
  password: 'strong-password-123',
  firstName: 'New',
  lastName: 'Barber',
  userType: 'BARBER',
};

const latestVerificationCode = async (email: string): Promise<string> => {
  const result = await pool.query<{ code: string }>(
    `
      SELECT evt.code
      FROM email_verification_tokens evt
      JOIN users u ON u.id = evt.user_id
      WHERE u.email = $1
      ORDER BY evt.created_at DESC
      LIMIT 1
    `,
    [email],
  );
  const token = result.rows[0];

  if (token === undefined) {
    throw new Error('Verification token was not created.');
  }

  return token.code;
};

beforeEach(async () => {
  await resetTestDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('authentication API', () => {
  it('registers a barber and rejects duplicate email and public admin creation', async () => {
    const created = await request(app).post('/auth/register').send(registration);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      email: registration.email,
      userType: 'BARBER',
      emailVerified: false,
    });

    const duplicate = await request(app).post('/auth/register').send(registration);
    expect(duplicate.status).toBe(400);
    expect(duplicate.body).toMatchObject({ code: 'EMAIL_ALREADY_EXISTS' });

    const admin = await request(app)
      .post('/auth/register')
      .send({ ...registration, email: 'admin@example.com', userType: 'ADMIN' });
    expect(admin.status).toBe(422);
  });

  it('blocks login until verification and prevents token reuse', async () => {
    await request(app).post('/auth/register').send(registration);

    const blocked = await request(app)
      .post('/auth/login')
      .send({ email: registration.email, password: registration.password });
    expect(blocked.status).toBe(403);
    expect(blocked.body).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });

    const code = await latestVerificationCode(registration.email);
    const verified = await request(app)
      .post('/auth/verify-email')
      .send({ email: registration.email, verificationCode: code });
    expect(verified.status).toBe(200);

    const reused = await request(app)
      .post('/auth/verify-email')
      .send({ email: registration.email, verificationCode: code });
    expect(reused.status).toBe(400);

    const login = await request(app)
      .post('/auth/login')
      .send({ email: registration.email, password: registration.password });
    expect(login.status).toBe(200);
    expect(login.body).toHaveProperty('accessToken');
  });

  it('rejects expired verification codes and resends a replacement', async () => {
    await request(app).post('/auth/register').send(registration);
    const expiredCode = await latestVerificationCode(registration.email);
    await pool.query(
      `
        UPDATE email_verification_tokens
        SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute'
        WHERE code = $1
      `,
      [expiredCode],
    );

    const expired = await request(app)
      .post('/auth/verify-email')
      .send({ email: registration.email, verificationCode: expiredCode });
    expect(expired.status).toBe(400);

    const resent = await request(app)
      .post('/auth/resend-verification')
      .send({ email: registration.email });
    expect(resent.status).toBe(200);
    expect(await latestVerificationCode(registration.email)).not.toBe(expiredCode);
  });

  it('refreshes tokens, authorizes profile access, and invalidates a logged-out access token', async () => {
    await createVerifiedUser('BARBER', 'verified@example.com');
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'verified@example.com', password: 'strong-password-123' });
    const tokens = login.body as TokenBody;

    const me = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokens.accessToken}`);
    expect(me.status).toBe(200);
    expect((me.body as ProfileBody).createdAt).toEqual(expect.any(String));

    const refreshed = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: tokens.refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body).toHaveProperty('accessToken');

    expect(
      (await request(app).post('/auth/logout').set('Authorization', `Bearer ${tokens.accessToken}`))
        .status,
    ).toBe(200);

    expect(
      (await request(app).get('/auth/me').set('Authorization', `Bearer ${tokens.accessToken}`))
        .status,
    ).toBe(401);
  });

  it('resets a password once without revealing unknown accounts', async () => {
    await createVerifiedUser('CLIENT', 'reset@example.com');

    const unknown = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'unknown@example.com' });
    expect(unknown.status).toBe(200);

    await request(app).post('/auth/forgot-password').send({ email: 'reset@example.com' });
    const result = await pool.query<{ code: string }>(
      `
        SELECT prt.code
        FROM password_reset_tokens prt
        JOIN users u ON u.id = prt.user_id
        WHERE u.email = 'reset@example.com'
        ORDER BY prt.created_at DESC
        LIMIT 1
      `,
    );
    const code = result.rows[0]?.code;
    expect(code).toEqual(expect.any(String));

    const reset = await request(app).post('/auth/reset-password').send({
      email: 'reset@example.com',
      resetCode: code,
      newPassword: 'new-strong-password-123',
    });
    expect(reset.status).toBe(200);

    const reused = await request(app).post('/auth/reset-password').send({
      email: 'reset@example.com',
      resetCode: code,
      newPassword: 'another-password-123',
    });
    expect(reused.status).toBe(400);

    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'reset@example.com', password: 'new-strong-password-123' });
    expect(login.status).toBe(200);
  });
});
