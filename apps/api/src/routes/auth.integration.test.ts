import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '../app';
import { closeDatabase, pool } from '../config/database';
import { createVerifiedUser, resetTestDatabase } from '../test/fixtures';

type ProfileBody = { id: string; email: string; userType: string };
type ErrorBody = { error: string };

const CLERK_USER_ID = 'user_test_sync_target';

vi.mock('@clerk/backend', () => ({
  createClerkClient: (): unknown => ({
    users: {
      getUser: vi.fn(() =>
        Promise.resolve({
          emailAddresses: [
            {
              id: 'idn_primary',
              emailAddress: 'new.barber@example.com',
              verification: { status: 'verified' },
            },
          ],
          primaryEmailAddressId: 'idn_primary',
          firstName: 'New',
          lastName: 'Barber',
        }),
      ),
      updateUserMetadata: vi.fn(() => Promise.resolve({})),
    },
  }),
}));

beforeEach(async () => {
  await resetTestDatabase();
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

  it('rejects /auth/me for a user with no local row', async () => {
    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer user_test_unknown');

    expect(response.status).toBe(401);
    expect((response.body as ErrorBody).error).toBeDefined();
  });
});
