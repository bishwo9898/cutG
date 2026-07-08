import { randomBytes, randomInt } from 'node:crypto';

import type {
  AuthUser,
  AuthUserSummary,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  ResetPasswordRequest,
  UpdateProfileRequest,
  VerifyEmailRequest,
} from '@barber-saas/shared-types';
import type { PoolClient } from 'pg';

import { pool } from '../../config/database';
import {
  blacklistToken,
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  createEmailVerificationToken,
  createPasswordResetToken,
  createUser,
  findPublicUserById,
  findUserByEmail,
  markEmailVerified,
  updatePasswordHash,
} from '../../db/queries/auth.queries';
import { AppError } from '../../middleware/errorHandler';
import type { AuthenticatedUser } from '../../types/auth';

import { sendPasswordResetEmail, sendVerificationEmail } from './emailService';
import { hashPassword, verifyPassword } from './passwordService';
import { createAccessToken, createTokenPair, verifyToken } from './tokenService';
import { getCurrentUser, toAuthUserSummary, updateCurrentUser } from './userService';

type RegisterResult = AuthUserSummary & {
  createdAt: string;
  message: string;
};

type VerifyEmailResult = {
  message: string;
  emailVerified: true;
};

type RefreshResult = {
  accessToken: string;
  expiresIn: number;
};

type MessageResult = {
  message: string;
};

type PasswordMessageResult = MessageResult & {
  email: string;
};

type PgError = Error & {
  code?: string;
  constraint?: string;
};

const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000;
const PASSWORD_RESET_CODE_TTL_MS = 60 * 60 * 1000;

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const generateVerificationCode = (): string => randomInt(100_000, 1_000_000).toString();

const generateResetCode = (): string => randomBytes(16).toString('hex');

const isUniqueViolation = (error: unknown): error is PgError => {
  return error instanceof Error && (error as PgError).code === '23505';
};

const withTransaction = async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const registerUser = async (input: RegisterRequest): Promise<RegisterResult> => {
  const email = normalizeEmail(input.email);
  const existingUser = await findUserByEmail(email);

  if (existingUser !== null) {
    throw new AppError(400, 'Email already registered.', 'EMAIL_ALREADY_EXISTS');
  }

  const passwordHash = await hashPassword(input.password);
  const verificationCode = generateVerificationCode();
  const verificationExpiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

  try {
    const user = await withTransaction(async (client) => {
      const createdUser = await createUser(
        {
          email,
          passwordHash,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          userType: input.userType,
        },
        client,
      );

      await createEmailVerificationToken(
        createdUser.id,
        verificationCode,
        verificationExpiresAt,
        client,
      );

      return createdUser;
    });

    await sendVerificationEmail({
      email: user.email,
      code: verificationCode,
      expiresAt: verificationExpiresAt,
    });

    return {
      ...toAuthUserSummary(user),
      createdAt: user.created_at.toISOString(),
      message: 'Account created. Check email to verify.',
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(400, 'Email already registered.', 'EMAIL_ALREADY_EXISTS');
    }

    throw error;
  }
};

export const verifyEmail = async (input: VerifyEmailRequest): Promise<VerifyEmailResult> => {
  const email = normalizeEmail(input.email);
  const user = await findUserByEmail(email);

  if (user === null) {
    throw new AppError(400, 'Verification code is incorrect or expired.', 'INVALID_CODE');
  }

  return withTransaction(async (client) => {
    const wasConsumed = await consumeEmailVerificationToken(
      user.id,
      input.verificationCode,
      client,
    );

    if (!wasConsumed) {
      throw new AppError(400, 'Verification code is incorrect or expired.', 'INVALID_CODE');
    }

    await markEmailVerified(user.id, client);

    return {
      message: 'Email verified successfully.',
      emailVerified: true,
    };
  });
};

export const loginUser = async (input: LoginRequest): Promise<LoginResponse> => {
  const user = await findUserByEmail(normalizeEmail(input.email));

  if (user === null || !user.is_active) {
    throw new AppError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS');
  }

  const passwordMatches = await verifyPassword(input.password, user.password_hash);

  if (!passwordMatches) {
    throw new AppError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS');
  }

  const tokenPair = createTokenPair({
    id: user.id,
    email: user.email,
    userType: user.user_type,
    emailVerified: user.email_verified,
  });

  return {
    accessToken: tokenPair.accessToken.token,
    refreshToken: tokenPair.refreshToken.token,
    expiresIn: tokenPair.accessToken.expiresIn,
    user: toAuthUserSummary(user),
  };
};

export const refreshAccessToken = async (refreshToken: string): Promise<RefreshResult> => {
  const payload = verifyToken(refreshToken, 'refresh');
  const user = await findPublicUserById(payload.sub);

  if (user === null || !user.is_active) {
    throw new AppError(401, 'Refresh token expired or invalid.', 'INVALID_TOKEN');
  }

  const accessToken = createAccessToken({
    id: user.id,
    email: user.email,
    userType: user.user_type,
    emailVerified: user.email_verified,
  });

  return {
    accessToken: accessToken.token,
    expiresIn: accessToken.expiresIn,
  };
};

export const logoutUser = async (user: AuthenticatedUser): Promise<MessageResult> => {
  await blacklistToken(user.jti, user.id, user.tokenExpiresAt);

  return {
    message: 'Logged out successfully.',
  };
};

export const getProfile = async (userId: string): Promise<AuthUser> => {
  return getCurrentUser(userId);
};

export const updateProfile = async (
  userId: string,
  input: UpdateProfileRequest,
): Promise<AuthUser> => {
  const updateInput: Parameters<typeof updateCurrentUser>[1] = {};

  if (input.firstName !== undefined) {
    updateInput.firstName = input.firstName.trim();
  }

  if (input.lastName !== undefined) {
    updateInput.lastName = input.lastName.trim();
  }

  if (Object.hasOwn(input, 'phone')) {
    updateInput.phone = input.phone ?? null;
  }

  return updateCurrentUser(userId, updateInput);
};

export const forgotPassword = async (
  input: ForgotPasswordRequest,
): Promise<PasswordMessageResult> => {
  const email = normalizeEmail(input.email);
  const user = await findUserByEmail(email);

  if (user !== null && user.is_active) {
    const resetCode = generateResetCode();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_CODE_TTL_MS);

    await withTransaction(async (client) => {
      await createPasswordResetToken(user.id, resetCode, expiresAt, client);
    });

    await sendPasswordResetEmail({
      email: user.email,
      code: resetCode,
      expiresAt,
    });
  }

  return {
    message: 'Password reset link sent to email.',
    email,
  };
};

export const resetPassword = async (
  input: ResetPasswordRequest,
): Promise<PasswordMessageResult> => {
  const email = normalizeEmail(input.email);
  const user = await findUserByEmail(email);

  if (user === null || !user.is_active) {
    throw new AppError(400, 'Reset code is invalid or expired.', 'INVALID_CODE');
  }

  const passwordHash = await hashPassword(input.newPassword);

  await withTransaction(async (client) => {
    const wasConsumed = await consumePasswordResetToken(user.id, input.resetCode, client);

    if (!wasConsumed) {
      throw new AppError(400, 'Reset code is invalid or expired.', 'INVALID_CODE');
    }

    await updatePasswordHash(user.id, passwordHash, client);
  });

  return {
    message: 'Password reset successfully. Please login.',
    email,
  };
};
