import type { PoolClient, QueryResult, QueryResultRow } from 'pg';

import { query } from '../../utils/database';

export type Queryable = {
  query: <T extends QueryResultRow>(text: string, params?: unknown[]) => Promise<QueryResult<T>>;
};

export type UserRecord = {
  id: string;
  email: string;
  password_hash: string;
  phone: string | null;
  first_name: string;
  last_name: string;
  user_type: 'BARBER' | 'CLIENT' | 'ADMIN';
  is_active: boolean;
  email_verified: boolean;
  email_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type PublicUserRecord = Omit<UserRecord, 'password_hash' | 'email_verified_at'>;

export type CreateUserInput = {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  userType: UserRecord['user_type'];
};

export type UpdateUserProfileInput = {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
};

const publicUserColumns = `
  id,
  email,
  phone,
  first_name,
  last_name,
  user_type,
  is_active,
  email_verified,
  created_at,
  updated_at
`;

const userColumns = `
  ${publicUserColumns},
  password_hash,
  email_verified_at
`;

const getQueryable = (client?: PoolClient): Queryable => client ?? { query };

export const findUserByEmail = async (
  email: string,
  client?: PoolClient,
): Promise<UserRecord | null> => {
  const result = await getQueryable(client).query<UserRecord>(
    `
      SELECT ${userColumns}
      FROM users
      WHERE lower(email) = lower($1)
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [email],
  );

  return result.rows[0] ?? null;
};

export const findPublicUserById = async (
  userId: string,
  client?: PoolClient,
): Promise<PublicUserRecord | null> => {
  const result = await getQueryable(client).query<PublicUserRecord>(
    `
      SELECT ${publicUserColumns}
      FROM users
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0] ?? null;
};

export const createUser = async (
  input: CreateUserInput,
  client: PoolClient,
): Promise<PublicUserRecord> => {
  const result = await client.query<PublicUserRecord>(
    `
      INSERT INTO users (email, password_hash, first_name, last_name, user_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING ${publicUserColumns}
    `,
    [input.email, input.passwordHash, input.firstName, input.lastName, input.userType],
  );
  const user = result.rows[0];

  if (user === undefined) {
    throw new Error('User creation did not return a row.');
  }

  return user;
};

export const updateUserProfile = async (
  userId: string,
  input: UpdateUserProfileInput,
): Promise<PublicUserRecord | null> => {
  const result = await query<PublicUserRecord>(
    `
      UPDATE users
      SET
        first_name = COALESCE($2, first_name),
        last_name = COALESCE($3, last_name),
        phone = CASE WHEN $4::boolean THEN $5 ELSE phone END
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING ${publicUserColumns}
    `,
    [
      userId,
      input.firstName ?? null,
      input.lastName ?? null,
      Object.hasOwn(input, 'phone'),
      input.phone ?? null,
    ],
  );

  return result.rows[0] ?? null;
};

export const markEmailVerified = async (userId: string, client: PoolClient): Promise<void> => {
  await client.query(
    `
      UPDATE users
      SET email_verified = true,
          email_verified_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [userId],
  );
};

export const updatePasswordHash = async (
  userId: string,
  passwordHash: string,
  client: PoolClient,
): Promise<void> => {
  await client.query(
    `
      UPDATE users
      SET password_hash = $2
      WHERE id = $1
    `,
    [userId, passwordHash],
  );
};

export const createEmailVerificationToken = async (
  userId: string,
  code: string,
  expiresAt: Date,
  client: PoolClient,
): Promise<void> => {
  await client.query(
    `
      INSERT INTO email_verification_tokens (user_id, code, expires_at)
      VALUES ($1, $2, $3)
    `,
    [userId, code, expiresAt],
  );
};

export const consumeEmailVerificationToken = async (
  userId: string,
  code: string,
  client: PoolClient,
): Promise<boolean> => {
  const result = await client.query<{ id: string }>(
    `
      UPDATE email_verification_tokens
      SET used_at = CURRENT_TIMESTAMP
      WHERE id = (
        SELECT id
        FROM email_verification_tokens
        WHERE user_id = $1
          AND code = $2
          AND used_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC
        LIMIT 1
      )
      RETURNING id
    `,
    [userId, code],
  );

  return result.rowCount === 1;
};

export const createPasswordResetToken = async (
  userId: string,
  code: string,
  expiresAt: Date,
  client: PoolClient,
): Promise<void> => {
  await client.query(
    `
      INSERT INTO password_reset_tokens (user_id, code, expires_at)
      VALUES ($1, $2, $3)
    `,
    [userId, code, expiresAt],
  );
};

export const consumePasswordResetToken = async (
  userId: string,
  code: string,
  client: PoolClient,
): Promise<boolean> => {
  const result = await client.query<{ id: string }>(
    `
      UPDATE password_reset_tokens
      SET used_at = CURRENT_TIMESTAMP
      WHERE id = (
        SELECT id
        FROM password_reset_tokens
        WHERE user_id = $1
          AND code = $2
          AND used_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC
        LIMIT 1
      )
      RETURNING id
    `,
    [userId, code],
  );

  return result.rowCount === 1;
};

export const blacklistToken = async (
  tokenJti: string,
  userId: string,
  expiresAt: Date,
): Promise<void> => {
  await query(
    `
      INSERT INTO token_blacklist (token_jti, user_id, expires_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (token_jti) DO NOTHING
    `,
    [tokenJti, userId, expiresAt],
  );
};

export const isTokenBlacklisted = async (tokenJti: string): Promise<boolean> => {
  const result = await query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM token_blacklist
        WHERE token_jti = $1
          AND expires_at > CURRENT_TIMESTAMP
      ) AS exists
    `,
    [tokenJti],
  );

  return result.rows[0]?.exists ?? false;
};
