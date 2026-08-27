import { getAuth } from '@clerk/express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { findUserByClerkId } from '../db/queries/auth.queries';
import type { AuthenticatedRequest, AuthenticatedUser } from '../types/auth';

import { AppError } from './errorHandler';

const authenticateRequest = async (
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { userId } = getAuth(request);

    if (userId === null) {
      throw new AppError(401, 'No valid session provided.', 'UNAUTHORIZED');
    }

    const user = await findUserByClerkId(userId);

    if (user === null || !user.is_active) {
      throw new AppError(401, 'No valid session provided.', 'UNAUTHORIZED');
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      userType: user.user_type,
      emailVerified: user.email_verified,
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

/**
 * Verifies a Clerk session without requiring a local `users` row to already exist. Used only by
 * `POST /auth/sync`, which is what creates that row for a brand-new Clerk sign-up.
 */
export const requireClerkSession: RequestHandler = (
  request: Request,
  _response: Response,
  next: NextFunction,
): void => {
  const { userId } = getAuth(request);

  if (userId === null) {
    next(new AppError(401, 'No valid session provided.', 'UNAUTHORIZED'));
    return;
  }

  next();
};

export const requireRoles = (...roles: AuthenticatedUser['userType'][]): RequestHandler => {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const authenticatedRequest = request as Partial<AuthenticatedRequest>;

    if (authenticatedRequest.auth === undefined) {
      next(new AppError(401, 'No valid session provided.', 'UNAUTHORIZED'));
      return;
    }

    if (!roles.includes(authenticatedRequest.auth.userType)) {
      next(new AppError(403, 'You do not have permission to access this resource.', 'FORBIDDEN'));
      return;
    }

    next();
  };
};
