import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { findPublicUserById, isTokenBlacklisted } from '../db/queries/auth.queries';
import { tokenExpiresAtFromPayload, verifyToken } from '../services/auth/tokenService';
import type { AuthenticatedRequest, AuthenticatedUser } from '../types/auth';

import { AppError } from './errorHandler';

const getBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (authorizationHeader === undefined) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || token === undefined || token.trim() === '') {
    return null;
  }

  return token;
};

const authenticateRequest = async (
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = getBearerToken(request.header('authorization'));

    if (token === null) {
      throw new AppError(401, 'No valid token provided.', 'UNAUTHORIZED');
    }

    const payload = verifyToken(token, 'access');
    const isBlacklisted = await isTokenBlacklisted(payload.jti);

    if (isBlacklisted) {
      throw new AppError(401, 'No valid token provided.', 'UNAUTHORIZED');
    }

    const user = await findPublicUserById(payload.sub);

    if (user === null || !user.is_active) {
      throw new AppError(401, 'No valid token provided.', 'UNAUTHORIZED');
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      userType: user.user_type,
      emailVerified: user.email_verified,
      jti: payload.jti,
      tokenExpiresAt: tokenExpiresAtFromPayload(payload),
    };

    (request as AuthenticatedRequest).auth = authenticatedUser;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAuth: RequestHandler = (
  request: Request,
  response: Response,
  next: NextFunction,
): void => {
  void authenticateRequest(request, response, next).catch(next);
};

export const requireRoles = (...roles: AuthenticatedUser['userType'][]): RequestHandler => {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const authenticatedRequest = request as Partial<AuthenticatedRequest>;

    if (authenticatedRequest.auth === undefined) {
      next(new AppError(401, 'No valid token provided.', 'UNAUTHORIZED'));
      return;
    }

    if (!roles.includes(authenticatedRequest.auth.userType)) {
      next(new AppError(403, 'You do not have permission to access this resource.', 'FORBIDDEN'));
      return;
    }

    next();
  };
};
