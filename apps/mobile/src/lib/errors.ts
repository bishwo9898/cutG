import { ApiError, ApiTimeoutError } from '@barber-saas/api-client';

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

/**
 * Whether the server actually rejected this session, as opposed to never having been reached.
 *
 * The distinction decides whether someone stays signed in. A 401 means the credentials are no
 * longer good and the app should let go of the account; a timeout, a DNS failure or a dropped
 * connection means only that the phone is on a bad network — which on mobile is most of the time.
 * Treating the second as the first is how a barber standing in a basement gets told to sign in
 * again, with a perfectly valid session sitting in secure storage.
 */
export const isAuthRejection = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);
