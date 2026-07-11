import { describe, expect, it } from 'vitest';

import { calculateTravelFeeCents, suggestTravelFee } from './mobileBarberService';

describe('mobile barber fees', () => {
  it('suggests progressively lower per-mile rates for wider service areas', () => {
    expect(suggestTravelFee(5)).toMatchObject({ flat: 1000, perMile: 200 });
    expect(suggestTravelFee(10)).toMatchObject({ flat: 1500, perMile: 175 });
    expect(suggestTravelFee(25)).toMatchObject({ flat: 2000, perMile: 150 });
    expect(suggestTravelFee(40)).toMatchObject({ flat: 3000, perMile: 125 });
  });

  it('calculates flat, rounded per-mile, and free travel fees', () => {
    expect(calculateTravelFeeCents({ fee_structure: 'flat', base_fee_cents: 1500 }, 3.4)).toBe(
      1500,
    );
    expect(
      calculateTravelFeeCents({ fee_structure: 'per_mile', per_mile_rate_cents: 200 }, 3.4),
    ).toBe(800);
    expect(calculateTravelFeeCents({ fee_structure: 'free' }, 3.4)).toBe(0);
  });
});
