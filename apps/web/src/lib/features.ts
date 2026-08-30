/**
 * AI Hair Studio is still being built, so it is hidden from the public site and from ordinary
 * customer accounts rather than shipped half-finished. Accounts flagged in Clerk keep access, which
 * is what allows the feature to be exercised against production while it is being worked on.
 *
 * To give an account access, set `aiStudio: true` in its Clerk publicMetadata (Clerk dashboard ->
 * Users -> the user -> Metadata -> Public). Flip AI_STUDIO_PUBLIC to true to launch it to everyone;
 * nothing else needs to change.
 */
export const AI_STUDIO_PUBLIC = false;

export const hasAiStudioAccess = (publicMetadata: unknown): boolean => {
  if (AI_STUDIO_PUBLIC) {
    return true;
  }

  return (publicMetadata as { aiStudio?: unknown } | null | undefined)?.aiStudio === true;
};
