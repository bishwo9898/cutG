import type { NextFunction, Request, Response } from 'express';

import { logger } from '../utils/logger';

export const requestLogger = (request: Request, response: Response, next: NextFunction): void => {
  const startedAt = performance.now();

  response.on('finish', (): void => {
    logger.info('HTTP request completed', {
      method: request.method,
      path: request.originalUrl,
      statusCode: response.statusCode,
      durationMs: Math.round(performance.now() - startedAt),
    });
  });

  next();
};
