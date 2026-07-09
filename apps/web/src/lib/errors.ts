import { ApiError } from '@barber-saas/api-client';

export const errorMessage = (error: unknown): string => {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
};
