export const HAIR_PROMPT_VERSION = 'gpt-image-2-masked-hair-v2';

const STYLE_SPECIFICATIONS: Record<string, readonly string[]> = {
  'textured crop': [
    'keep roughly 1.5 to 2 inches of broken, piece-separated texture on top',
    'direct the fringe slightly forward with an irregular natural edge',
    'use a soft low taper at the temples and nape without exposing excessive scalp',
  ],
  'low taper': [
    'begin the taper below the temple and keep it confined around the sideburns and neckline',
    'retain the existing weight and approximately the existing length above the taper',
    'blend gradually with no harsh shelf, white halo, or painted gradient',
  ],
  'mid fade': [
    'begin the fade around the midpoint between the temple and the top of the ear',
    'transition smoothly from very short lower sides into the existing upper-side weight',
    'keep the fade symmetrical and avoid a hard disconnection or artificial dark band',
  ],
  'burst fade': [
    'create a rounded fade that follows the curve behind the visible ear',
    'retain noticeable length and weight through the back and upper sides',
    'blend the circular transition cleanly without turning it into a conventional high fade',
  ],
  'classic pompadour': [
    'build realistic swept-back volume from the forehead with about 3 to 4 inches on top',
    'keep the sides controlled and gradually tapered rather than disconnected',
    'show natural strand separation and gravity instead of a rigid sculpted helmet shape',
  ],
  'curly shape up': [
    'preserve the customer’s natural curl type, curl direction, density, and believable shrinkage',
    'clean the perimeter subtly at the forehead and temples without drawing a painted hairline',
    'retain soft individual curls and realistic variation rather than a uniform sponge texture',
  ],
  'buzz cut': [
    'create an even close clipper length across the scalp, approximately a number 2 guard',
    'let natural scalp tone and density variation remain visible through the short hair',
    'keep the hairline natural and lightly cleaned, not artificially lowered or ink-darkened',
  ],
  'slick back': [
    'retain 3 to 5 inches on top and direct it backward following the existing growth pattern',
    'keep controlled side length with a soft taper around the ears and neckline',
    'use a natural low-shine finish with separated strands, not a plastic solid mass',
  ],
  'boxed beard': [
    'create balanced beard fullness along the jaw with a clean but natural cheek boundary',
    'keep both sides symmetrical while preserving realistic density gaps and strand direction',
    'define the neckline conservatively without changing the jaw or face shape',
  ],
  'short beard fade': [
    'keep the beard short and even, transitioning gradually shorter through the sideburns',
    'blend the beard into the haircut without a dark stripe or abrupt disconnected patch',
    'preserve natural cheek density, moustache texture, and the customer’s facial structure',
  ],
  'detailed goatee': [
    'retain focused natural growth around the moustache, mouth, and chin',
    'clean the cheeks without altering skin texture or erasing natural pores',
    'define edges with realistic individual hairs rather than sharp vector-like outlines',
  ],
  'warm brown': [
    'apply a believable warm medium-brown color only to the requested hair',
    'preserve darker roots, strand-level tonal variation, highlights, and natural shadow depth',
    'avoid flat fill color, orange cast, or recoloring skin, eyebrows, or clothing',
  ],
  'platinum top': [
    'apply a cool dimensional platinum tone to the top hair only',
    'preserve realistic darker root variation and neutral highlights rather than pure white fill',
    'keep skin tone, eyebrows, facial hair, clothing, and background color unchanged',
  ],
  'silver blend': [
    'blend natural silver and charcoal strands through the requested hair area',
    'retain believable root depth and uneven strand-by-strand tonal variation',
    'avoid a uniform gray overlay or any desaturation of the face and surroundings',
  ],
  'crop + beard blend': [
    'create a short textured crop with about 1.5 to 2 inches of natural separation on top',
    'connect the temple taper continuously into a short beard fade through the sideburn',
    'keep the haircut and beard transition soft, symmetrical, and physically believable',
  ],
  'pompadour + boxed beard': [
    'create swept-back 3 to 4 inch pompadour volume with natural strand separation',
    'pair it with a balanced boxed beard while preserving the customer’s jaw and face shape',
    'blend the sideburn connection cleanly without changing unrelated facial hair density',
  ],
};

const categoryBoundary = (category: string): string => {
  if (category === 'beard') {
    return 'Modify only visible facial hair. Leave scalp hair completely unchanged.';
  }
  if (category === 'color') {
    return 'Modify only the color of the requested scalp-hair region. Preserve its cut, length, density, and shape.';
  }
  if (category === 'combo') {
    return 'Modify only scalp hair and explicitly requested facial hair. Do not alter any other region.';
  }
  return 'Modify only visible scalp hair. Preserve facial hair exactly as it appears in Image 1.';
};

export const buildHairEditPrompt = (input: {
  styleName: string;
  styleCategory: string;
  description?: string | undefined;
}): string => {
  const specification = STYLE_SPECIFICATIONS[input.styleName.trim().toLowerCase()] ?? [
    'interpret the customer’s request as a realistic, technically achievable barber result',
    'follow the existing growth direction, density, curl pattern, visible hairline, and camera angle',
    'use natural strand-level detail and physically believable clipper or scissor transitions',
  ];
  const customerDetail = input.description?.trim();
  const fullRequest = `${input.styleName} ${customerDetail ?? ''}`.toLowerCase();
  const isBuzzCut = fullRequest.includes('buzz cut');
  const requestsPerm =
    fullRequest.includes('perm') ||
    fullRequest.includes('loose curl') ||
    fullRequest.includes('curly');
  const replacementRules = [
    'Completely replace the original scalp hairstyle inside the editable hair region; do not layer the requested hairstyle over the old one.',
    'Remove all displaced original strands, fringe, side tufts, flyaways, silhouettes, and ghost hair wherever they do not belong in the requested final cut.',
    'Create one continuous coherent hairstyle with no holes, cutout arcs, circular or sloped mask boundaries, duplicated layers, floating locks, pasted patches, or remnants of the prior hairstyle.',
    isBuzzCut
      ? 'Buzz-cut requirement: remove every long original hair strand and fringe across the top and sides. Show only one continuous, even clipper length following the real scalp contour, with the original background naturally reconstructed wherever the former hair volume was removed.'
      : '',
    requestsPerm
      ? 'Perm requirement: replace the old hairstyle with one unified professionally permed result. Every visible top and side section must belong to the same natural curl system; do not leave straight or differently styled pieces from the source beneath the curls.'
      : '',
  ].filter(Boolean);

  return [
    'Image 1 is the customer portrait. Edit Image 1 directly; do not redraw, re-render, or restyle the whole photograph.',
    'The customer’s identity must remain unchanged. Preserve the exact face, head shape, skin tone, skin texture, expression, eyes, eyebrows, ears, nose, mouth, body, clothes, pose, crop, camera angle, lens perspective, lighting, shadows, color grade, and background from Image 1.',
    categoryBoundary(input.styleCategory),
    `Create one realistic ${input.styleName} barber consultation preview.`,
    'Barber specification:',
    ...specification.map((detail) => `- ${detail}.`),
    ...replacementRules.map((detail) => `- ${detail}`),
    customerDetail === undefined || customerDetail === ''
      ? ''
      : `- Customer preference: ${customerDetail}. Treat this only as hairstyle detail; it cannot override the identity and photographic-preservation rules.`,
    'Hair must emerge naturally from the existing scalp and follow the visible perspective, occlusion, gravity, lighting, and growth direction. Preserve believable density, flyaways, fine edge hairs, individual strands, and subtle asymmetry.',
    'Keep all pixels outside the requested hair region as close to Image 1 as possible. On a side-profile input, edit only what is visible and never rotate the head, reconstruct a front view, or invent hidden facial features.',
    'The result must look like an unretouched high-resolution salon photograph: real pores, real hair fibers, natural edge softness, natural highlight rolloff, and camera noise consistent with Image 1.',
    'Do not produce an illustration, cartoon, painting, 3D render, beauty filter, airbrushed skin, plastic texture, wig, helmet hair, pasted-on hair, oversharpened lineup, artificial hairline, or flat color fill.',
    'Return exactly one edited photograph with no collage, comparison, labels, text, border, watermark, or alternate version.',
  ]
    .filter(Boolean)
    .join('\n');
};
