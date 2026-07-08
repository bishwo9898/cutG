import {
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  RefreshTokenRequestSchema,
  RegisterRequestSchema,
  ResetPasswordRequestSchema,
  UpdateProfileRequestSchema,
  VerifyEmailRequestSchema,
} from '@barber-saas/shared-types';
import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
  type Router as ExpressRouter,
} from 'express';

import { requireAuth } from '../middleware/auth';
import {
  forgotPassword,
  getProfile,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  resetPassword,
  updateProfile,
  verifyEmail,
} from '../services/auth/authService';
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
  '/register',
  asyncHandler(async (request, response): Promise<void> => {
    const body = RegisterRequestSchema.parse(request.body);
    const result = await registerUser(body);

    response.status(201).json(result);
  }),
);

authRouter.post(
  '/verify-email',
  asyncHandler(async (request, response): Promise<void> => {
    const body = VerifyEmailRequestSchema.parse(request.body);
    const result = await verifyEmail(body);

    response.json(result);
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (request, response): Promise<void> => {
    const body = LoginRequestSchema.parse(request.body);
    const result = await loginUser(body);

    response.json(result);
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (request, response): Promise<void> => {
    const body = RefreshTokenRequestSchema.parse(request.body);
    const result = await refreshAccessToken(body.refreshToken);

    response.json(result);
  }),
);

authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (request, response): Promise<void> => {
    const authenticatedRequest = request as AuthenticatedRequest;
    const result = await logoutUser(authenticatedRequest.auth);

    response.json(result);
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (request, response): Promise<void> => {
    const authenticatedRequest = request as AuthenticatedRequest;
    const result = await getProfile(authenticatedRequest.auth.id);

    response.json(result);
  }),
);

authRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (request, response): Promise<void> => {
    const authenticatedRequest = request as AuthenticatedRequest;
    const body = UpdateProfileRequestSchema.parse(request.body);
    const result = await updateProfile(authenticatedRequest.auth.id, body);

    response.json(result);
  }),
);

authRouter.post(
  '/forgot-password',
  asyncHandler(async (request, response): Promise<void> => {
    const body = ForgotPasswordRequestSchema.parse(request.body);
    const result = await forgotPassword(body);

    response.json(result);
  }),
);

authRouter.post(
  '/reset-password',
  asyncHandler(async (request, response): Promise<void> => {
    const body = ResetPasswordRequestSchema.parse(request.body);
    const result = await resetPassword(body);

    response.json(result);
  }),
);
