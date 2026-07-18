export const HAIR_PROMPT_VERSION = 'flux-kontext-hair-v1';

export const buildHairEditPrompt = (input: {
  styleName: string;
  styleCategory: string;
  description?: string | undefined;
}): string =>
  [
    'Create a photorealistic professional hairstyle visualization from the supplied portrait.',
    `Requested ${input.styleCategory}: ${input.styleName}.`,
    input.description?.trim() ?? '',
    'Change only the hair and facial hair explicitly requested.',
    'Preserve the exact person, facial identity, skin tone, facial structure, expression, eyes, body, clothing, camera angle, lighting, and background.',
    'Keep natural hairline detail, realistic individual strands, believable density, and salon-quality grooming.',
    'Do not beautify, age, reshape, recolor skin, add accessories, or alter any unrelated feature.',
  ]
    .filter(Boolean)
    .join(' ');
