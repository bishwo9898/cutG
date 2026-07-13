import { describe, expect, it } from 'vitest';

import {
  addMinutes,
  appointmentEndsAt,
  combineSlotDateTime,
  travelLeadStartsAt,
} from './booking-time';

describe('booking-time helpers', () => {
  it('combines a slot date and clock time in local time', () => {
    const value = combineSlotDateTime('2026-07-12', '09:30');

    expect(value.getFullYear()).toBe(2026);
    expect(value.getMonth()).toBe(6);
    expect(value.getDate()).toBe(12);
    expect(value.getHours()).toBe(9);
    expect(value.getMinutes()).toBe(30);
  });

  it('calculates appointment end times across hour boundaries', () => {
    const value = appointmentEndsAt('2026-07-12', '09:30', 45);

    expect(value.getHours()).toBe(10);
    expect(value.getMinutes()).toBe(15);
  });

  it('calculates travel lead times across midnight boundaries', () => {
    const value = travelLeadStartsAt('2026-07-12', '00:15', 30);

    expect(value.getDate()).toBe(11);
    expect(value.getHours()).toBe(23);
    expect(value.getMinutes()).toBe(45);
  });

  it('adds minutes without mutating the original date', () => {
    const start = combineSlotDateTime('2026-07-12', '10:00');
    const end = addMinutes(start, 20);

    expect(start.getMinutes()).toBe(0);
    expect(end.getMinutes()).toBe(20);
  });
});
