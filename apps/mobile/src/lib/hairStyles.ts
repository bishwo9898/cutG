export const HAIR_STYLES = {
  haircut: ['Fade', 'Taper', 'Textured Top', 'Slick Back', 'Buzz Cut', 'Undercut'],
  beard: ['Full Beard', 'Stubble', 'Goatee', 'Beard Fade', 'Line Up'],
  color: ['Keep Natural', 'Highlights', 'Full Color', 'Fade to Color'],
} as const;

export type HairStyleCategory = keyof typeof HAIR_STYLES;
