import { describe, expect, it } from 'vitest';

import {
  formatWallClockDate,
  formatWallClockTime,
  wallClock,
  wallClockDate,
} from './appointmentTime';

describe('wallClock', () => {
  it('reads the components the API wrote, ignoring the Z', () => {
    expect(wallClock('2026-09-03T18:00:00.000Z')).toEqual({
      year: 2026,
      month: 9,
      day: 3,
      hour: 18,
      minute: 0,
    });
  });

  it('returns null for anything that is not an appointment timestamp', () => {
    expect(wallClock('')).toBeNull();
    expect(wallClock('tomorrow')).toBeNull();
    expect(wallClock('2026-13-03T18:00:00.000Z')).toBeNull();
    expect(wallClock('2026-09-03T25:00:00.000Z')).toBeNull();
  });
});

describe('wallClockDate', () => {
  it('builds a local Date holding the same clock reading, whatever the device zone', () => {
    const date = wallClockDate('2026-09-03T18:00:00.000Z');
    expect(date?.getHours()).toBe(18);
    expect(date?.getMinutes()).toBe(0);
    expect(date?.getDate()).toBe(3);
    expect(date?.getMonth()).toBe(8);
  });

  it('is not the same instant as a plain parse — that is the whole point', () => {
    // new Date(iso) is an instant in UTC; ours is 18:00 on the reader's own clock. They only
    // coincide when the device happens to be on UTC.
    const naive = wallClockDate('2026-09-03T18:00:00.000Z') as Date;
    const instant = new Date('2026-09-03T18:00:00.000Z');
    const offsetMinutes = naive.getTimezoneOffset();
    expect(naive.getTime() - instant.getTime()).toBe(offsetMinutes * 60_000);
  });
});

describe('formatting', () => {
  it('shows the booked time, not the time shifted into the device zone', () => {
    // A booking at 18:00 must read as 6 PM on a phone in New York, not 2 PM.
    expect(formatWallClockTime('2026-09-03T18:00:00.000Z')).toMatch(/\b6:00\s?PM\b/i);
  });

  it('keeps the appointment on the day it was booked, across a midnight boundary', () => {
    // 23:30 UTC-labelled would roll back to the previous day on any western device.
    expect(formatWallClockDate('2026-09-03T23:30:00.000Z')).toContain('Sep 3');
    expect(formatWallClockDate('2026-09-04T00:30:00.000Z')).toContain('Sep 4');
  });

  it('falls back to the raw value rather than printing Invalid Date', () => {
    expect(formatWallClockTime('not a date')).toBe('not a date');
    expect(formatWallClockDate('not a date')).toBe('not a date');
  });
});
