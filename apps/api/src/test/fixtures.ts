import { pool } from '../config/database';
import { hashPassword } from '../services/auth/passwordService';

type UserType = 'BARBER' | 'CLIENT';

type TestUser = {
  id: string;
  email: string;
  accessToken?: string;
};

export const resetTestDatabase = async (): Promise<void> => {
  await pool.query('TRUNCATE TABLE users CASCADE');
};

export const createVerifiedUser = async (
  userType: UserType,
  email: string,
  password = 'strong-password-123',
): Promise<TestUser> => {
  const passwordHash = await hashPassword(password);
  const result = await pool.query<{ id: string; email: string }>(
    `
      INSERT INTO users (
        email,
        password_hash,
        first_name,
        last_name,
        user_type,
        email_verified,
        email_verified_at
      )
      VALUES ($1, $2, 'Test', 'User', $3, true, CURRENT_TIMESTAMP)
      RETURNING id, email
    `,
    [email, passwordHash, userType],
  );
  const user = result.rows[0];

  if (user === undefined) {
    throw new Error('Test user fixture was not created.');
  }

  return user;
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
