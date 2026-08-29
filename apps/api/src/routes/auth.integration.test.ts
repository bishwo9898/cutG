import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '../app';
import { closeDatabase, pool } from '../config/database';
import { createVerifiedUser, resetTestDatabase } from '../test/fixtures';

type ProfileBody = { id: string; email: string; userType: string };
type ErrorBody = { error: string };

const CLERK_USER_ID = 'user_test_sync_target';

const clerkAccount = {
  emailAddress: 'new.barber@example.com',
  verificationStatus: 'verified',
  firstName: 'New',
  lastName: 'Barber',
};

vi.mock('@clerk/backend', () => ({
  createClerkClient: (): unknown => ({
    users: {
      getUser: vi.fn(() =>
        Promise.resolve({
          emailAddresses: [
            {
              id: 'idn_primary',
              emailAddress: clerkAccount.emailAddress,
              verification: { status: clerkAccount.verificationStatus },
            },
          ],
          primaryEmailAddressId: 'idn_primary',
          firstName: clerkAccount.firstName,
          lastName: clerkAccount.lastName,
        }),
      ),
      updateUserMetadata: vi.fn(() => Promise.resolve({})),
    },
  }),
}));

beforeEach(async () => {
  await resetTestDatabase();
  clerkAccount.emailAddress = 'new.barber@example.com';
  clerkAccount.verificationStatus = 'verified';
  clerkAccount.firstName = 'New';
  clerkAccount.lastName = 'Barber';
});

afterAll(async () => closeDatabase());

describe('auth routes', () => {
  it('creates a local user on first /auth/sync and is idempotent on repeat calls', async () => {
    const first = await request(app)
      .post('/auth/sync')
      .set('Authorization', `Bearer ${CLERK_USER_ID}`)
      .send({ userType: 'BARBER' });

    expect(first.status).toBe(200);
    const body = first.body as ProfileBody;
    expect(body.email).toBe('new.barber@example.com');
    expect(body.userType).toBe('BARBER');

    const userRow = await pool.query<{ clerk_user_id: string }>(
      'SELECT clerk_user_id FROM users WHERE email = $1',
      ['new.barber@example.com'],
    );
    expect(userRow.rows[0]?.clerk_user_id).toBe(CLERK_USER_ID);

    const second = await request(app)
      .post('/auth/sync')
      .set('Authorization', `Bearer ${CLERK_USER_ID}`)
      .send({ userType: 'BARBER' });

    expect(second.status).toBe(200);
    expect((second.body as ProfileBody).id).toBe(body.id);

    const countResult = await pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM users WHERE email = $1',
      ['new.barber@example.com'],
    );
    expect(countResult.rows[0]?.count).toBe('1');
  });

  it('rejects /auth/sync without a valid session', async () => {
    const response = await request(app).post('/auth/sync').send({ userType: 'BARBER' });

    expect(response.status).toBe(401);
  });

  it('returns the current user profile from /auth/me', async () => {
    const user = await createVerifiedUser('CLIENT', 'client.me@example.com');

    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${user.clerkUserId}`);

    expect(response.status).toBe(200);
    expect((response.body as ProfileBody).email).toBe('client.me@example.com');
  });

  it('adopts a pre-existing unlinked row instead of failing on the unique email', async () => {
    // Seeded accounts, and any row created before the Clerk migration, have clerk_user_id NULL.
    // Inserting a second row for the same email would violate users_email_unique, so /auth/sync
    // has to claim the existing row — which is what makes a seeded login behave like a real one.
    await pool.query(
      `INSERT INTO users (email, first_name, last_name, user_type, email_verified)
       VALUES ($1, 'Seeded', 'Barber', 'BARBER', true)`,
      ['seeded.barber@example.com'],
    );
    clerkAccount.emailAddress = 'seeded.barber@example.com';

    const response = await request(app)
      .post('/auth/sync')
      .set('Authorization', `Bearer ${CLERK_USER_ID}`)
      .send({ userType: 'BARBER' });

    expect(response.status).toBe(200);
    expect((response.body as ProfileBody).email).toBe('seeded.barber@example.com');

    const rows = await pool.query<{ id: string; clerk_user_id: string; first_name: string }>(
      'SELECT id, clerk_user_id, first_name FROM users WHERE email = $1',
      ['seeded.barber@example.com'],
    );
    // The original row is reused, not duplicated, so its seeded data stays attached to the login.
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0]?.clerk_user_id).toBe(CLERK_USER_ID);
    expect(rows.rows[0]?.first_name).toBe('Seeded');
    expect((response.body as ProfileBody).id).toBe(rows.rows[0]?.id);

    // /auth/me now resolves, which is what puts the account in the navbar.
    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${CLERK_USER_ID}`);
    expect(me.status).toBe(200);
    expect((me.body as ProfileBody).email).toBe('seeded.barber@example.com');
  });

  it('keeps the adopted row’s own role rather than the one the caller asked for', async () => {
    await pool.query(
      `INSERT INTO users (email, first_name, last_name, user_type, email_verified)
       VALUES ($1, 'Seeded', 'Client', 'CLIENT', true)`,
      ['seeded.client@example.com'],
    );
    clerkAccount.emailAddress = 'seeded.client@example.com';

    const response = await request(app)
      .post('/auth/sync')
      .set('Authorization', `Bearer ${CLERK_USER_ID}`)
      .send({ userType: 'BARBER' });

    expect(response.status).toBe(200);
    expect((response.body as ProfileBody).userType).toBe('CLIENT');
  });

  it('refuses to adopt an existing row when Clerk has not verified the email', async () => {
    await pool.query(
      `INSERT INTO users (email, first_name, last_name, user_type, email_verified)
       VALUES ($1, 'Real', 'Owner', 'CLIENT', true)`,
      ['victim@example.com'],
    );
    clerkAccount.emailAddress = 'victim@example.com';
    clerkAccount.verificationStatus = 'unverified';

    const response = await request(app)
      .post('/auth/sync')
      .set('Authorization', `Bearer ${CLERK_USER_ID}`)
      .send({ userType: 'CLIENT' });

    expect(response.status).toBe(403);

    const rows = await pool.query<{ clerk_user_id: string | null }>(
      'SELECT clerk_user_id FROM users WHERE email = $1',
      ['victim@example.com'],
    );
    expect(rows.rows[0]?.clerk_user_id).toBeNull();
  });

  it('does not adopt a row that is already linked to a different Clerk account', async () => {
    const existing = await createVerifiedUser('CLIENT', 'taken@example.com');
    clerkAccount.emailAddress = 'taken@example.com';

    const response = await request(app)
      .post('/auth/sync')
      .set('Authorization', 'Bearer user_test_someone_else')
      .send({ userType: 'CLIENT' });

    expect(response.status).toBeGreaterThanOrEqual(400);

    const rows = await pool.query<{ clerk_user_id: string }>(
      'SELECT clerk_user_id FROM users WHERE email = $1',
      ['taken@example.com'],
    );
    expect(rows.rows[0]?.clerk_user_id).toBe(existing.clerkUserId);
  });

  it('rejects /auth/me for a user with no local row', async () => {
    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer user_test_unknown');

    expect(response.status).toBe(401);
    expect((response.body as ErrorBody).error).toBeDefined();
  });
});
