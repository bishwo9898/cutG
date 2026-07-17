import { describe, expect, it } from 'vitest';

import { buildHairEditPrompt, pickMockSuggestions } from './prompts';

const preferences = {
  desiredLength: 'short',
  maintenance: 'low',
  texture: 'natural',
  fadePreference: 'low',
  overallStyle: 'clean',
} as const;

describe('hair studio prompts', () => {
  it('requires identity preservation and hair-only editing', () => {
    const prompt = buildHairEditPrompt({ styleName: 'Textured Crop', description: null });
    expect(prompt).toContain('Identity preservation is mandatory');
    expect(prompt).toContain('Change only scalp hair');
    expect(prompt).toContain('Textured Crop');
  });

  it('returns three controlled mock recommendations', () => {
    const suggestions = pickMockSuggestions(preferences);
    expect(suggestions).toHaveLength(3);
    expect(new Set(suggestions.map((suggestion) => suggestion.id)).size).toBe(3);
  });
});
