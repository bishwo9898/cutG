import { SyncRequestSchema, UpdateProfileRequestSchema } from '@barber-saas/shared-types';
import { getAuth } from '@clerk/express';
import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
  type Router as ExpressRouter,
} from 'express';

import type { UpdateUserProfileInput } from '../db/queries/auth.queries';
import { requireAuth, requireClerkSession } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimit';
import { syncUser } from '../services/auth/clerkSyncService';
import { getCurrentUser, updateCurrentUser } from '../services/auth/userService';
import type { AuthenticatedRequest } from '../types/auth';

export const authRouter: ExpressRouter = Router();

const asyncHandler = (
  handler: (request: Request, response: Response) => Promise<void>,
): RequestHandler => {
  return (request: Request, response: Response, next: NextFunction): void => {
    void handler(request, response).catch(next);
  };
};

authRouter.post(
  '/sync',
  authRateLimiter,
  requireClerkSession,
  asyncHandler(async (request, response): Promise<void> => {
    const body = SyncRequestSchema.parse(request.body);
    const { userId } = getAuth(request);
    const result = await syncUser(userId as string, body.userType);

    response.json(result);
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (request, response): Promise<void> => {
    const authenticatedRequest = request as AuthenticatedRequest;
    const result = await getCurrentUser(authenticatedRequest.auth.id);

    response.json(result);
  }),
);

authRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (request, response): Promise<void> => {
    const authenticatedRequest = request as AuthenticatedRequest;
    const body = UpdateProfileRequestSchema.parse(request.body);
    const updateInput: UpdateUserProfileInput = {};

    if (body.firstName !== undefined) {
      updateInput.firstName = body.firstName;
    }
    if (body.lastName !== undefined) {
      updateInput.lastName = body.lastName;
    }
    if (Object.hasOwn(body, 'phone')) {
      updateInput.phone = body.phone ?? null;
    }

    const result = await updateCurrentUser(authenticatedRequest.auth.id, updateInput);

    response.json(result);
  }),
);
