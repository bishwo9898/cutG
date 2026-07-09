import { ApiError } from '@barber-saas/api-client';
import { describe, expect, it } from 'vitest';


import { errorMessage } from './errors';

describe('errorMessage', () => {
  it('preserves actionable API messages', () => {
    const error = new ApiError(403, {
      status: 'error',
      code: 'SERVICE_LIMIT_REACHED',
      message: 'Upgrade to add more services.',
    });

    expect(errorMessage(error)).toBe('Upgrade to add more services.');
  });

  it('falls back safely for unknown failures', () => {
    expect(errorMessage(null)).toBe('Something went wrong. Please try again.');
  });
});
