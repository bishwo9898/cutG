import { describe, expect, it } from 'vitest';

import { buildHairEditPrompt, HAIR_PROMPT_VERSION } from './hairPrompt';

describe('hair edit prompt', () => {
  it('locks identity and requests one hairstyle-only result', () => {
    const prompt = buildHairEditPrompt({
      styleName: 'Low Taper',
      styleCategory: 'haircut',
      description: 'Keep natural curls on top.',
    });

    expect(HAIR_PROMPT_VERSION).toBe('flux-kontext-hair-v3');
    expect(prompt).toContain('Low Taper');
    expect(prompt).toContain('Keep natural curls on top.');
    expect(prompt).toContain('Preserve facial hair exactly when it is not requested.');
    expect(prompt).toContain('pose, crop, camera angle, lens perspective');
    expect(prompt).toContain('Do not beautify, age, reshape, relight');
    expect(prompt).toContain('hairlines, individual strands, density, edges');
    expect(prompt).toContain('Return exactly one edited image.');
  });
});
