const enabled = (value: string | undefined, fallback = false): boolean =>
  value === undefined ? fallback : value.toLowerCase() === 'true';

export const mobileFeatures = {
  hairStudio: enabled(process.env.EXPO_PUBLIC_ENABLE_HAIR_STUDIO),
  earnings: enabled(process.env.EXPO_PUBLIC_ENABLE_EARNINGS),
  subscriptions: enabled(process.env.EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS),
} as const;

/**
 * Mirrors `hasAiStudioAccess` in `apps/web/src/lib/features.ts`, so an account flagged for the
 * in-progress AI Hair Studio gets it on both platforms rather than only on the web.
 *
 * The build flag is the "shipped to everyone" switch — the counterpart of the web's
 * AI_STUDIO_PUBLIC. Below that, access is per account: set `aiStudio: true` in the user's Clerk
 * publicMetadata (Clerk dashboard -> Users -> Metadata -> Public).
 *
 * `=== true` is deliberate. publicMetadata is untyped JSON, so a stray "true" string must not be
 * enough to open an unfinished feature up.
 */
export const hasAiStudioAccess = (publicMetadata: unknown): boolean => {
  if (mobileFeatures.hairStudio) {
    return true;
  }

  return (publicMetadata as { aiStudio?: unknown } | null | undefined)?.aiStudio === true;
};
