import { ApiError, ApiTimeoutError } from '@barber-saas/api-client';
import { describe, expect, it } from 'vitest';

import { errorMessage, isAuthRejection } from './errors';

describe('isAuthRejection', () => {
  it('is true only when the server actually turned the session down', () => {
    expect(
      isAuthRejection(new ApiError(401, { status: 'error' as const, message: 'Unauthorized' })),
    ).toBe(true);
    expect(
      isAuthRejection(new ApiError(403, { status: 'error' as const, message: 'Forbidden' })),
    ).toBe(true);
  });

  it('is false when the phone simply could not reach the server', () => {
    // These are the ones that used to sign a barber out on a bad connection.
    expect(isAuthRejection(new ApiTimeoutError(20_000))).toBe(false);
    expect(isAuthRejection(new TypeError('Network request failed'))).toBe(false);
    expect(isAuthRejection(undefined)).toBe(false);
  });

  it('is false for server faults, which say nothing about who you are', () => {
    expect(
      isAuthRejection(new ApiError(502, { status: 'error' as const, message: 'Bad gateway' })),
    ).toBe(false);
    expect(
      isAuthRejection(new ApiError(500, { status: 'error' as const, message: 'Server error' })),
    ).toBe(false);
  });
});

describe('errorMessage', () => {
  it('translates a timeout into something a customer can act on', () => {
    expect(errorMessage(new ApiTimeoutError(20_000))).toMatch(/check your connection/i);
  });

  it('passes through a real message from the server', () => {
    expect(
      errorMessage(
        new ApiError(400, {
          status: 'error' as const,
          message: 'This time slot is no longer available.',
        }),
      ),
    ).toBe('This time slot is no longer available.');
  });

  it('falls back rather than showing an empty string', () => {
    expect(errorMessage(null)).toBe('Something went wrong. Please try again.');
  });
});
