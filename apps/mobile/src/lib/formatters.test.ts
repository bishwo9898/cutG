import { describe, expect, it } from 'vitest';

import { humanLabel, money } from './formatters';

describe('customer-facing formatters', () => {
  it('replaces internal appointment and payment values with plain language', () => {
    expect(humanLabel('ON_THE_WAY')).toBe('On the way');
    expect(humanLabel('CARD')).toBe('Pay online');
    expect(humanLabel('CASH')).toBe('Pay in person');
    expect(humanLabel('SUCCEEDED')).toBe('Paid');
  });

  it('creates a readable fallback for future values', () => {
    expect(humanLabel('ACTION_REQUIRED')).toBe('Action required');
  });

  it('formats private-beta prices as US dollars', () => {
    expect(money(42.5)).toBe('$42.50');
  });
});
