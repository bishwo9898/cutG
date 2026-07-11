import { randomUUID } from 'node:crypto';

import type { UserType } from '@barber-saas/shared-types';
import {
  sign,
  verify,
  type JwtPayload as JsonWebTokenPayload,
  type SignOptions,
} from 'jsonwebtoken';

import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';
import type { JwtPayload, JwtTokenType } from '../../types/auth';

type TokenSubject = {
  id: string;
  email: string;
  userType: UserType;
  emailVerified: boolean;
};

type IssuedToken = {
  token: string;
  jti: string;
  expiresAt: Date;
  expiresIn: number;
};

type TokenPair = {
  accessToken: IssuedToken;
  refreshToken: IssuedToken;
};

const DEFAULT_ACCESS_TOKEN_SECONDS = 24 * 60 * 60;
const DEFAULT_REFRESH_TOKEN_SECONDS = 30 * 24 * 60 * 60;

const durationPattern = /^(\d+)([smhd])$/;

const parseDurationSeconds = (duration: string, fallbackSeconds: number): number => {
  const trimmedDuration = duration.trim();
  const numericSeconds = Number(trimmedDuration);

  if (Number.isFinite(numericSeconds) && numericSeconds > 0) {
    return Math.floor(numericSeconds);
  }

  const match = durationPattern.exec(trimmedDuration);

  if (match === null) {
    return fallbackSeconds;
  }

  const amount = Number(match[1]);
  const unit = match[2];

  if (!Number.isFinite(amount) || amount <= 0) {
    return fallbackSeconds;
  }

  switch (unit) {
    case 's':
      return amount;
    case 'm':
      return amount * 60;
    case 'h':
      return amount * 60 * 60;
    case 'd':
      return amount * 24 * 60 * 60;
    default:
      return fallbackSeconds;
  }
};

export const ACCESS_TOKEN_EXPIRES_IN_SECONDS = parseDurationSeconds(
  env.JWT_EXPIRY,
  DEFAULT_ACCESS_TOKEN_SECONDS,
);
export const REFRESH_TOKEN_EXPIRES_IN_SECONDS = parseDurationSeconds(
  env.JWT_REFRESH_EXPIRY,
  DEFAULT_REFRESH_TOKEN_SECONDS,
);

const createExpiresAt = (expiresInSeconds: number): Date => {
  return new Date(Date.now() + expiresInSeconds * 1000);
};

const createToken = (
  subject: TokenSubject,
  tokenType: JwtTokenType,
  expiresIn: NonNullable<SignOptions['expiresIn']>,
  expiresInSeconds: number,
): IssuedToken => {
  const jti = randomUUID();
  const payload = {
    sub: subject.id,
    email: subject.email,
    userType: subject.userType,
    emailVerified: subject.emailVerified,
    type: tokenType,
    jti,
  };
  const signOptions: SignOptions = {
    expiresIn,
  };

  return {
    token: sign(payload, env.JWT_SECRET, signOptions),
    jti,
    expiresAt: createExpiresAt(expiresInSeconds),
    expiresIn: expiresInSeconds,
  };
};

export const createTokenPair = (subject: TokenSubject): TokenPair => {
  return {
    accessToken: createToken(
      subject,
      'access',
      env.JWT_EXPIRY as NonNullable<SignOptions['expiresIn']>,
      ACCESS_TOKEN_EXPIRES_IN_SECONDS,
    ),
    refreshToken: createToken(
      subject,
      'refresh',
      env.JWT_REFRESH_EXPIRY as NonNullable<SignOptions['expiresIn']>,
      REFRESH_TOKEN_EXPIRES_IN_SECONDS,
    ),
  };
};

export const createAccessToken = (subject: TokenSubject): IssuedToken => {
  return createToken(
    subject,
    'access',
    env.JWT_EXPIRY as NonNullable<SignOptions['expiresIn']>,
    ACCESS_TOKEN_EXPIRES_IN_SECONDS,
  );
};

const isJwtPayload = (payload: string | JsonWebTokenPayload): payload is JwtPayload => {
  return (
    typeof payload !== 'string' &&
    typeof payload.sub === 'string' &&
    typeof payload.email === 'string' &&
    (payload.userType === 'BARBER' ||
      payload.userType === 'CLIENT' ||
      payload.userType === 'ADMIN') &&
    typeof payload.emailVerified === 'boolean' &&
    (payload.type === 'access' || payload.type === 'refresh') &&
    typeof payload.jti === 'string' &&
    typeof payload.iat === 'number' &&
    typeof payload.exp === 'number'
  );
};

export const verifyToken = (token: string, expectedType: JwtTokenType): JwtPayload => {
  try {
    const payload = verify(token, env.JWT_SECRET);

    if (!isJwtPayload(payload) || payload.type !== expectedType) {
      throw new AppError(401, 'Token type is invalid.', 'INVALID_TOKEN');
    }

    return payload;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(401, 'Token expired or invalid.', 'INVALID_TOKEN');
  }
};

export const tokenExpiresAtFromPayload = (payload: JwtPayload): Date => {
  return new Date(payload.exp * 1000);
};
