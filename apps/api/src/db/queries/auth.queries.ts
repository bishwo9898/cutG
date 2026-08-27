import type { PoolClient, QueryResult, QueryResultRow } from 'pg';

import { query } from '../../utils/database';

export type Queryable = {
  query: <T extends QueryResultRow>(text: string, params?: unknown[]) => Promise<QueryResult<T>>;
};

export type UserRecord = {
  id: string;
  clerk_user_id: string | null;
  email: string;
  phone: string | null;
  first_name: string;
  last_name: string;
  user_type: 'BARBER' | 'CLIENT' | 'ADMIN';
  is_active: boolean;
  email_verified: boolean;
  created_at: Date;
  updated_at: Date;
};

export type CreateUserInput = {
  clerkUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: UserRecord['user_type'];
  emailVerified: boolean;
};

export type UpdateUserProfileInput = {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
};

const userColumns = `
  id,
  clerk_user_id,
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

const getQueryable = (client?: PoolClient): Queryable => client ?? { query };

export const findUserByClerkId = async (
  clerkUserId: string,
  client?: PoolClient,
): Promise<UserRecord | null> => {
  const result = await getQueryable(client).query<UserRecord>(
    `
      SELECT ${userColumns}
      FROM users
      WHERE clerk_user_id = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [clerkUserId],
  );

  return result.rows[0] ?? null;
};

export const findPublicUserById = async (
  userId: string,
  client?: PoolClient,
): Promise<UserRecord | null> => {
  const result = await getQueryable(client).query<UserRecord>(
    `
      SELECT ${userColumns}
      FROM users
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0] ?? null;
};

export const createUserForClerkId = async (
  input: CreateUserInput,
  client?: PoolClient,
): Promise<UserRecord> => {
  const result = await getQueryable(client).query<UserRecord>(
    `
      INSERT INTO users (clerk_user_id, email, first_name, last_name, user_type, email_verified)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING ${userColumns}
    `,
    [
      input.clerkUserId,
      input.email,
      input.firstName,
      input.lastName,
      input.userType,
      input.emailVerified,
    ],
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
): Promise<UserRecord | null> => {
  const result = await query<UserRecord>(
    `
      UPDATE users
      SET
        first_name = COALESCE($2, first_name),
        last_name = COALESCE($3, last_name),
        phone = CASE WHEN $4::boolean THEN $5 ELSE phone END
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING ${userColumns}
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
