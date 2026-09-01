import { describe, expect, it } from 'vitest';

import { hasAiStudioAccess, mobileFeatures } from './features';

/**
 * Mirrors `apps/web/src/lib/features.test.ts`. The two gates have to agree, or a tester flagged in
 * Clerk would get AI Hair Studio on one platform and not the other.
 */
describe('hasAiStudioAccess', () => {
  it('is off by default, so the unfinished feature does not ship to everyone', () => {
    expect(mobileFeatures.hairStudio).toBe(false);
  });

  it('grants access to accounts flagged in Clerk', () => {
    expect(hasAiStudioAccess({ aiStudio: true })).toBe(true);
    expect(hasAiStudioAccess({ userType: 'CLIENT', aiStudio: true })).toBe(true);
  });

  it('denies everyone else, including signed-out users', () => {
    expect(hasAiStudioAccess({ userType: 'CLIENT' })).toBe(false);
    expect(hasAiStudioAccess({})).toBe(false);
    expect(hasAiStudioAccess(undefined)).toBe(false);
    expect(hasAiStudioAccess(null)).toBe(false);
  });

  it('does not treat a truthy non-true flag as access', () => {
    expect(hasAiStudioAccess({ aiStudio: 'true' })).toBe(false);
    expect(hasAiStudioAccess({ aiStudio: 1 })).toBe(false);
    expect(hasAiStudioAccess({ aiStudio: false })).toBe(false);
  });
});
