import { describe, expect, it } from 'vitest';

import { AI_STUDIO_PUBLIC, hasAiStudioAccess } from './features';

describe('hasAiStudioAccess', () => {
  it('keeps AI Hair Studio hidden while it is still being built', () => {
    // Guards the intent of the flag itself: if this flips to true the feature ships to everyone,
    // which should be a deliberate change rather than an accident.
    expect(AI_STUDIO_PUBLIC).toBe(false);
  });

  it('grants access to accounts flagged in Clerk', () => {
    expect(hasAiStudioAccess({ aiStudio: true })).toBe(true);
    expect(hasAiStudioAccess({ userType: 'CLIENT', aiStudio: true })).toBe(true);
  });

  it('denies everyone else, including signed-out visitors', () => {
    expect(hasAiStudioAccess({ userType: 'CLIENT' })).toBe(false);
    expect(hasAiStudioAccess({})).toBe(false);
    expect(hasAiStudioAccess(undefined)).toBe(false);
    expect(hasAiStudioAccess(null)).toBe(false);
  });

  it('does not treat a truthy non-true flag as access', () => {
    // publicMetadata is untyped JSON, so a stray string must not open the feature up.
    expect(hasAiStudioAccess({ aiStudio: 'true' })).toBe(false);
    expect(hasAiStudioAccess({ aiStudio: 1 })).toBe(false);
    expect(hasAiStudioAccess({ aiStudio: false })).toBe(false);
  });
});
