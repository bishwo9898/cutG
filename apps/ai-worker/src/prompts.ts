import type { HairPreferences } from '@barber-saas/shared-types';

export const HAIR_PRESET_CATALOG = [
  {
    id: 'textured-crop',
    name: 'Textured Crop',
    category: 'haircut',
    description: 'Short textured top with a clean tapered perimeter.',
  },
  {
    id: 'low-taper-curls',
    name: 'Low Taper Curls',
    category: 'haircut',
    description: 'Natural texture retained on top with a subtle low taper.',
  },
  {
    id: 'classic-side-part',
    name: 'Classic Side Part',
    category: 'haircut',
    description: 'Controlled side part with a softly tapered neckline.',
  },
  {
    id: 'modern-quiff',
    name: 'Modern Quiff',
    category: 'haircut',
    description: 'Medium volume through the front with balanced short sides.',
  },
  {
    id: 'buzz-fade',
    name: 'Buzz Fade',
    category: 'haircut',
    description: 'Uniform short top blended into a precise fade.',
  },
  {
    id: 'medium-flow',
    name: 'Medium Flow',
    category: 'haircut',
    description: 'Natural medium-length movement with tidy edges.',
  },
] as const;

export type CatalogSuggestion = (typeof HAIR_PRESET_CATALOG)[number] & { reason: string };

export const buildSuggestionPrompt = (preferences: HairPreferences): string => `
You are cutG's hairstyle recommendation assistant. Review the three photographs only to understand
current hair length, visible texture, and styling constraints. Never infer or mention race, ethnicity,
health, gender identity, attractiveness, personality, or any other sensitive trait.

Client preferences: ${JSON.stringify(preferences)}
Allowed catalog: ${JSON.stringify(HAIR_PRESET_CATALOG)}

Return JSON only: an array of exactly three objects with id, name, category, description, and reason.
Every id must come from the allowed catalog. Keep each reason practical and under 140 characters.
`;

export const buildHairEditPrompt = (style: {
  styleName: string;
  description: string | null;
}): string => `
PROMPT_VERSION: hair-edit-v1
Create one photorealistic front/three-quarter hairstyle visualization of the same adult shown in the
three reference photographs. Apply only this hairstyle: ${style.styleName}.
Styling direction: ${style.description ?? 'Use a polished, barber-realistic interpretation.'}

Identity preservation is mandatory. Keep the person's facial identity, facial geometry, skin tone,
expression, eyes, eyebrows, facial hair, body, clothing, jewelry, lighting, camera character, and
background unchanged. Change only scalp hair and the immediately adjacent hairline. Use believable
strands, density, growth direction, edge blending, and salon-quality detail. Do not beautify, reshape,
age, de-age, change skin, add makeup, or alter the background. Return one image and no collage.
`;

export const pickMockSuggestions = (preferences: HairPreferences): CatalogSuggestion[] => {
  const preferred =
    preferences.desiredLength === 'very-short'
      ? ['buzz-fade', 'textured-crop', 'low-taper-curls']
      : preferences.desiredLength === 'long' || preferences.desiredLength === 'keep-length'
        ? ['medium-flow', 'modern-quiff', 'classic-side-part']
        : ['textured-crop', 'classic-side-part', 'modern-quiff'];
  return preferred.map((id) => {
    const preset = HAIR_PRESET_CATALOG.find(
      (item) => item.id === id,
    ) as (typeof HAIR_PRESET_CATALOG)[number];
    return {
      ...preset,
      reason: `Fits your ${preferences.maintenance} maintenance and ${preferences.overallStyle} style preferences.`,
    };
  });
};
