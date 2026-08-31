/**
 * The ivory palette, kept deliberately in step with the web app's design tokens in
 * `apps/web/src/app/styles/ivory-tokens.css`. `colors.test.ts` reads that file and fails if the
 * two drift apart, which is how the stale secondary text colour here was caught.
 *
 * Contrast: tokens are split into ones that are safe behind words and ones that are not. Anything
 * under 4.5:1 on the ivory surfaces is fine for an icon, a border, or a fill, and not fine for
 * body text. The `*Text` variants exist for exactly that case — reach for them when a decorative
 * tone needs to carry a label.
 */
export const colors = {
  primary: '#171513',
  accent: '#171513',

  // Decorative champagne. ~2.9:1 on the ivory surfaces, so it is for icons, rules, and fills.
  accentLight: '#B29262',
  gold: '#B29262',
  // Text-safe champagne: the same hue stepped down until it clears 4.5:1 on every ivory surface.
  // Use this whenever champagne is carrying words (eyebrows, labels, small print).
  goldText: '#776242',

  background: '#F7F3EC',
  surface: '#FFFDF9',
  surfaceRaised: '#FFFFFF',
  border: '#DDD4CA',
  borderLight: '#C9BBAE',

  textPrimary: '#171513',
  // 5.1:1 or better everywhere. Was #746B64, which dropped to 4.2:1 on the softer surfaces.
  textSecondary: '#6E665F',
  // Deliberately faint (~2.7:1) — for disabled states, placeholder glyphs and decorative rules,
  // never for text the customer has to read. Use textSecondary for that.
  textMuted: '#A69A91',
  textOnAccent: '#FFFDF9',

  success: '#356149',
  warning: '#74551F',
  error: '#874343',
  info: '#315D7A',

  statusPending: '#74551F',
  statusPendingSurface: '#FAF1DD',
  statusConfirmed: '#356149',
  statusConfirmedSurface: '#EAF3ED',
  statusOnTheWay: '#315D7A',
  statusOnTheWaySurface: '#E8F1F7',
  statusArrived: '#5C4F83',
  statusArrivedSurface: '#F0ECF7',
  statusInProgress: '#765322',
  statusInProgressSurface: '#F5ECDB',
  statusCompleted: '#2F5E46',
  statusCompletedSurface: '#E6F1EA',
  statusCancelled: '#874343',
  statusCancelledSurface: '#F8EAEA',
  statusNoShow: '#874343',
} as const;

export type ColorToken = keyof typeof colors;

/** Surfaces text can land on. Used by the contrast test to check every text-safe token. */
export const textBackgrounds = [colors.background, colors.surface, colors.surfaceRaised] as const;

/** Tokens that are allowed to carry body text, and so must clear 4.5:1 on every surface above. */
export const textSafeColors = {
  textPrimary: colors.textPrimary,
  textSecondary: colors.textSecondary,
  goldText: colors.goldText,
  success: colors.success,
  warning: colors.warning,
  error: colors.error,
  info: colors.info,
} as const;
