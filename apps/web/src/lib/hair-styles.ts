export const HAIR_STYLE_PRESETS = {
  haircut: [
    { id: 'fade', name: 'Fade', description: 'Gradual blend from skin to length' },
    { id: 'taper', name: 'Taper', description: 'Length tapers toward the neckline' },
    { id: 'textured', name: 'Textured Top', description: 'Natural movement and texture on top' },
    { id: 'slick', name: 'Slick Back', description: 'Clean, controlled shape brushed back' },
    { id: 'buzz', name: 'Buzz Cut', description: 'Short, consistent length all over' },
    { id: 'undercut', name: 'Undercut', description: 'Close sides with longer length on top' },
  ],
  beard: [
    { id: 'full', name: 'Full Beard', description: 'Full length with a clean shape' },
    { id: 'stubble', name: 'Stubble', description: 'Short and evenly maintained' },
    { id: 'goatee', name: 'Goatee', description: 'Focused shape around chin and mouth' },
    { id: 'fade_beard', name: 'Beard Fade', description: 'Smooth transition through sideburns' },
    { id: 'lineup', name: 'Line Up', description: 'Sharp, carefully defined edges' },
  ],
  color: [
    { id: 'natural', name: 'Keep Natural', description: 'Preserve the current color' },
    { id: 'highlights', name: 'Highlights', description: 'Lighter dimension through the hair' },
    { id: 'full_color', name: 'Full Color', description: 'An all-over color change' },
    { id: 'fade_color', name: 'Fade to Color', description: 'A gradual color transition' },
  ],
} as const;

export type HairStyleCategory = keyof typeof HAIR_STYLE_PRESETS;
