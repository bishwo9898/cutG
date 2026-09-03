import { ApiTimeoutError } from '@barber-saas/api-client';

import { ApiError } from './apiClient';

export const errorMessage = (error: unknown): string => {
  // A timeout means the phone could not reach the API in time, not that anything was rejected.
  // Its raw message ("The request timed out after 20000ms") is developer-facing, so say something
  // the customer can act on instead.
  if (error instanceof ApiTimeoutError) {
    return 'That took too long. Check your connection and try again.';
  }
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
};
