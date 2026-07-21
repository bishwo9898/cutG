import { ApiError, MOBILE_API_URL } from './apiClient';

export const errorMessage = (error: unknown): string => {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
};

export const authErrorMessage = (error: unknown): string => {
  if (error instanceof TypeError) {
    return `Cannot reach the cutG API at ${MOBILE_API_URL}. Check that pnpm dev is running and the device is on the same network.`;
  }
  return errorMessage(error);
};
