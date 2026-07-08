import { describe, expect, it } from 'vitest';

import { addDaysToDate, datesBetween, generateDaySlots, isoDayOfWeek } from './slotGenerator';

describe('slotGenerator', () => {
  it('generates slots ending exactly at closing time', () => {
    expect(generateDaySlots('09:00', '11:00', 30)).toEqual([
      { startTime: '09:00', endTime: '09:30' },
      { startTime: '09:30', endTime: '10:00' },
      { startTime: '10:00', endTime: '10:30' },
      { startTime: '10:30', endTime: '11:00' },
    ]);
  });

  it('does not generate a slot beyond closing time', () => {
    expect(generateDaySlots('09:00', '10:10', 45)).toEqual([
      { startTime: '09:00', endTime: '09:45' },
    ]);
  });

  it('handles UTC date boundaries and ISO weekdays', () => {
    expect(addDaysToDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(datesBetween('2026-07-06', '2026-07-08')).toEqual([
      '2026-07-06',
      '2026-07-07',
      '2026-07-08',
    ]);
    expect(isoDayOfWeek('2026-07-06')).toBe(1);
    expect(isoDayOfWeek('2026-07-12')).toBe(7);
  });
});
