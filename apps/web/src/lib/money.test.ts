import { describe, expect, it } from 'vitest';

import { formatPrice } from './money';

describe('formatPrice', () => {
  it('formats decimal database values and invalid fallbacks safely', () => {
    expect(formatPrice('25.00')).toBe('$25.00');
    expect(formatPrice(26)).toBe('$26.00');
    expect(formatPrice(null)).toBe('$0.00');
    expect(formatPrice('not-money')).toBe('$0.00');
  });
});
