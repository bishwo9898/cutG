import { randomUUID } from 'node:crypto';

import { pool } from '../config/database';

type UserType = 'BARBER' | 'CLIENT';

type TestUser = {
  id: string;
  email: string;
  clerkUserId: string;
};

export const resetTestDatabase = async (): Promise<void> => {
  await pool.query('TRUNCATE TABLE users CASCADE');
};

/**
 * Inserts a local `users` row as if `/auth/sync` had already run for it, keyed by a fake
 * `clerk_user_id`. Integration tests authenticate by mocking `@clerk/express`'s `getAuth` to
 * return this `clerkUserId` rather than by signing a real Clerk session token.
 */
export const createVerifiedUser = async (
  userType: UserType,
  email: string,
): Promise<TestUser> => {
  const clerkUserId = `user_test_${randomUUID()}`;
  const result = await pool.query<{ id: string; email: string }>(
    `
      INSERT INTO users (
        clerk_user_id,
        email,
        first_name,
        last_name,
        user_type,
        email_verified
      )
      VALUES ($1, $2, 'Test', 'User', $3, true)
      RETURNING id, email
    `,
    [clerkUserId, email, userType],
  );
  const user = result.rows[0];

  if (user === undefined) {
    throw new Error('Test user fixture was not created.');
  }

  return { ...user, clerkUserId };
};

export const createBarberProfileFixture = async (userId: string): Promise<string> => {
  const result = await pool.query<{ id: string }>(
    `
      INSERT INTO barber_profiles (
        user_id,
        business_name,
        bio,
        city,
        state,
        address
      )
      VALUES ($1, 'Fixture Studio', 'Fixture profile', 'Boston', 'MA', '1 Test Street')
      RETURNING id
    `,
    [userId],
  );
  const profile = result.rows[0];

  if (profile === undefined) {
    throw new Error('Barber profile fixture was not created.');
  }

  await pool.query(
    `
      INSERT INTO barber_schedules (
        barber_id,
        day_of_week,
        start_time,
        end_time,
        slot_duration_minutes
      )
      VALUES ($1, 1, '09:00', '17:00', 30)
    `,
    [profile.id],
  );

  return profile.id;
};
