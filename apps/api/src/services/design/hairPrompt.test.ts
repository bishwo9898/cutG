import { describe, expect, it } from 'vitest';

import { buildHairEditPrompt, HAIR_PROMPT_VERSION } from './hairPrompt';

describe('hair edit prompt', () => {
  it('turns a preset into a concrete, identity-locked barber specification', () => {
    const prompt = buildHairEditPrompt({
      styleName: 'Low Taper',
      styleCategory: 'haircut',
      description: 'Keep natural curls on top',
    });

    expect(HAIR_PROMPT_VERSION).toBe('gpt-image-2-masked-hair-v1');
    expect(prompt).toContain('Image 1 is the customer portrait');
    expect(prompt).toContain('begin the taper below the temple');
    expect(prompt).toContain('Keep natural curls on top');
    expect(prompt).toContain('Modify only visible scalp hair');
    expect(prompt).toContain('side-profile input');
    expect(prompt).toContain('Do not produce an illustration, cartoon');
    expect(prompt).toContain('Return exactly one edited photograph');
  });

  it('keeps beard and color edits inside their requested regions', () => {
    const beard = buildHairEditPrompt({
      styleName: 'Boxed Beard',
      styleCategory: 'beard',
    });
    const color = buildHairEditPrompt({
      styleName: 'Warm Brown',
      styleCategory: 'color',
    });

    expect(beard).toContain('Leave scalp hair completely unchanged');
    expect(beard).toContain('without changing the jaw or face shape');
    expect(color).toContain('Preserve its cut, length, density, and shape');
    expect(color).toContain('strand-level tonal variation');
  });

  it('gives custom requests realistic fallback constraints', () => {
    const prompt = buildHairEditPrompt({
      styleName: 'My custom cut',
      styleCategory: 'haircut',
      description: 'Loose waves with a subtle neckline taper',
    });

    expect(prompt).toContain('technically achievable barber result');
    expect(prompt).toContain('existing growth direction');
    expect(prompt).toContain('Loose waves with a subtle neckline taper');
  });
});
