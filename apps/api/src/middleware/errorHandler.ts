import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { env } from '../config/env';
import { logger } from '../utils/logger';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  public constructor(
    statusCode: number,
    message: string,
    code = 'APP_ERROR',
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;

    if (details !== undefined) {
      this.details = details;
    }
  }
}

const toErrorResponse = (
  error: unknown,
): { statusCode: number; body: Record<string, unknown>; shouldLog: boolean } => {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: {
        status: 'error',
        error: error.code,
        message: error.message,
        statusCode: error.statusCode,
        code: error.code,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
      shouldLog: error.statusCode >= 500,
    };
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.too.large'
  ) {
    return {
      statusCode: 413,
      body: {
        status: 'error',
        error: 'PAYLOAD_TOO_LARGE',
        message: 'The uploaded file is too large.',
        statusCode: 413,
        code: 'PAYLOAD_TOO_LARGE',
      },
      shouldLog: false,
    };
  }

  const isZodError =
    error instanceof ZodError ||
    (error instanceof Error &&
      error.name === 'ZodError' &&
      'issues' in error &&
      Array.isArray((error as { issues?: unknown }).issues));

  if (isZodError) {
    const issues = (error as { issues: unknown[] }).issues;
    return {
      statusCode: 422,
      body: {
        status: 'error',
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        statusCode: 422,
        code: 'VALIDATION_ERROR',
        details: {
          issues,
        },
      },
      shouldLog: false,
    };
  }

  return {
    statusCode: 500,
    body: {
      status: 'error',
      error: 'INTERNAL_SERVER_ERROR',
      message: env.NODE_ENV === 'production' ? 'Internal server error' : 'Unexpected error',
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
    },
    shouldLog: true,
  };
};

export const notFoundHandler = (
  request: Request,
  _response: Response,
  next: NextFunction,
): void => {
  next(new AppError(404, `Route not found: ${request.method} ${request.path}`, 'ROUTE_NOT_FOUND'));
};

export const errorHandler = (
  error: unknown,
  request: Request,
  response: Response,
  next: NextFunction,
): void => {
  void next;
  const { body, shouldLog, statusCode } = toErrorResponse(error);

  if (shouldLog) {
    logger.error('Unhandled request error', error, {
      method: request.method,
      path: request.path,
    });
  }

  response.status(statusCode).json(body);
};
