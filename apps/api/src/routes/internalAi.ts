import { timingSafeEqual } from 'node:crypto';

import {
  Router,
  type NextFunction,
  type Request,
  type Response,
  type Router as ExpressRouter,
} from 'express';
import { z } from 'zod';

import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import {
  completeAiGeneration,
  failAiGeneration,
  startAiGeneration,
  updateAiGenerationProgress,
} from '../services/design/hairStudioService';

export const internalAiRouter: ExpressRouter = Router();

const asyncHandler =
  (handler: (request: Request, response: Response) => Promise<void>) =>
  (request: Request, response: Response, next: NextFunction): void => {
    void handler(request, response).catch(next);
  };

internalAiRouter.use((request, _response, next): void => {
  const serviceSecret = request.header('x-cutg-ai-secret');
  const supplied = Buffer.from(serviceSecret ?? request.header('authorization') ?? '');
  const expected = Buffer.from(
    serviceSecret === undefined ? `Bearer ${env.AI_INTERNAL_SECRET}` : env.AI_INTERNAL_SECRET,
  );
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    next(new AppError(401, 'Invalid internal AI credential.', 'AI_INTERNAL_UNAUTHORIZED'));
    return;
  }
  next();
});

const ParamsSchema = z.object({ generationId: z.string().uuid() });
const CompleteSchema = z.object({
  outputUrl: z.string().url(),
  providerRequestId: z.string().min(1).max(255),
  durationMs: z.number().int().nonnegative(),
  estimatedCostCents: z.number().nonnegative(),
});
const FailSchema = z.object({
  errorCode: z.string().min(1).max(80),
  errorMessage: z.string().min(1).max(1000),
});
const ProgressSchema = z.object({
  progress: z.number().int().min(16).max(95),
});

internalAiRouter.post(
  '/generations/:generationId/processing',
  asyncHandler(async (request, response) => {
    const { generationId } = ParamsSchema.parse(request.params);
    response.json(await startAiGeneration(generationId));
  }),
);

internalAiRouter.post(
  '/generations/:generationId/progress',
  asyncHandler(async (request, response) => {
    const { generationId } = ParamsSchema.parse(request.params);
    const { progress } = ProgressSchema.parse(request.body);
    response.json(await updateAiGenerationProgress(generationId, progress));
  }),
);

internalAiRouter.post(
  '/generations/:generationId/complete',
  asyncHandler(async (request, response) => {
    const { generationId } = ParamsSchema.parse(request.params);
    response.json(await completeAiGeneration(generationId, CompleteSchema.parse(request.body)));
  }),
);

internalAiRouter.post(
  '/generations/:generationId/fail',
  asyncHandler(async (request, response) => {
    const { generationId } = ParamsSchema.parse(request.params);
    response.json(await failAiGeneration(generationId, FailSchema.parse(request.body)));
  }),
);
