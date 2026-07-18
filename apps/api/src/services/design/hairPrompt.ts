export const HAIR_PROMPT_VERSION = 'flux-kontext-hair-v3';

export const buildHairEditPrompt = (input: {
  styleName: string;
  styleCategory: string;
  description?: string | undefined;
}): string =>
  [
    'Edit the supplied portrait into one photorealistic professional hairstyle visualization.',
    `Requested ${input.styleCategory}: ${input.styleName}.`,
    input.description?.trim() ?? '',
    'Change only the requested scalp hair or explicitly requested facial hair. Preserve facial hair exactly when it is not requested.',
    'Preserve the exact same person, facial identity, face, skin tone and texture, facial structure, expression, eyes, eyebrows, ears, body, clothes, pose, crop, camera angle, lens perspective, lighting, shadows, color grade, and background.',
    'Keep hairlines, individual strands, density, edges, texture, and blending natural and photorealistic.',
    'Do not beautify, age, reshape, relight, recolor skin, add accessories, or alter any unrelated feature.',
    'Return exactly one edited image. Do not create a collage, comparison, labels, text, borders, or alternate versions.',
  ]
    .filter(Boolean)
    .join(' ');
