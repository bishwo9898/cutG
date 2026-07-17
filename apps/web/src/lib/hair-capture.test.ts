import { describe, expect, it } from 'vitest';

import { assessPixels, requiredPose } from './hair-capture';

describe('hair capture quality', () => {
  it('validates each requested head pose', () => {
    expect(requiredPose('FRONT', 0.02)).toBe(true);
    expect(requiredPose('LEFT', -0.2)).toBe(true);
    expect(requiredPose('RIGHT', 0.2)).toBe(true);
    expect(requiredPose('FRONT', 0.2)).toBe(false);
  });

  it('rejects frames that are too dark', () => {
    const quality = assessPixels(new Uint8ClampedArray(160).fill(10));
    expect(quality.accepted).toBe(false);
    expect(quality.reason).toContain('brighter');
  });
});
