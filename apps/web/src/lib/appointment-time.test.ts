// The web renders appointment times in the *viewer's* browser, so this is where a wall-clock
// mistake bites hardest: a customer travelling, or simply living one state over from their barber,
// was being shown a time the barber never offered. These run on a non-UTC clock on purpose — with
// TZ=UTC the bug is invisible, which is how it survived in nine places.
process.env.TZ = 'America/New_York';

import {
  formatWallClock,
  formatWallClockTime,
  isWallClockInFuture,
} from '@barber-saas/shared-utils';
import { describe, expect, it } from 'vitest';

const SIX_PM = '2026-09-03T18:00:00.000Z';

describe('appointment times on the web', () => {
  it('shows the booked hour, not the hour shifted into the viewer’s zone', () => {
    expect(new Date(SIX_PM).toLocaleTimeString([], { hour: 'numeric' })).toContain('2');
    expect(formatWallClockTime(SIX_PM)).toMatch(/\b6:00\s?PM\b/i);
  });

  it('keeps the appointment on its own day either side of midnight', () => {
    expect(formatWallClock('2026-09-03T23:30:00.000Z', { dateStyle: 'medium' })).toContain('Sep 3');
    expect(formatWallClock('2026-09-04T00:30:00.000Z', { dateStyle: 'medium' })).toContain('Sep 4');
  });

  it('decides "can still cancel" on the barber’s clock', () => {
    const noon = new Date(2026, 8, 3, 12, 0);
    expect(isWallClockInFuture(SIX_PM, noon)).toBe(true);
    expect(isWallClockInFuture('2026-09-03T09:00:00.000Z', noon)).toBe(false);
    // The naive parse says 18:00Z is 14:00 local, still ahead of noon — so it agrees here by
    // luck. At 15:00 local it does not, and the cancel button would vanish three hours early.
    const threePm = new Date(2026, 8, 3, 15, 0);
    expect(isWallClockInFuture(SIX_PM, threePm)).toBe(true);
    expect(new Date(SIX_PM).getTime() > threePm.getTime()).toBe(false);
  });

  it('falls back to the raw value instead of rendering "Invalid Date"', () => {
    expect(formatWallClock('', { dateStyle: 'medium' })).toBe('');
    expect(formatWallClockTime('soon')).toBe('soon');
  });
});
