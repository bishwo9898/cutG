import type { UserType } from '@barber-saas/shared-types';
import type { Request } from 'express';

export type AuthenticatedUser = {
  id: string;
  email: string;
  userType: UserType;
  emailVerified: boolean;
  jti: string;
  tokenExpiresAt: Date;
};

export type AuthenticatedRequest = Request & {
  auth: AuthenticatedUser;
};

export type JwtTokenType = 'access' | 'refresh';

export type JwtPayload = {
  sub: string;
  email: string;
  userType: UserType;
  emailVerified: boolean;
  type: JwtTokenType;
  jti: string;
  iat: number;
  exp: number;
};
