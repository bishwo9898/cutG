import { describe, expect, it } from 'vitest';

import { bookableDays, isBookable, slotsForDay } from './booking';
import type { AvailabilitySlot } from './types';

const slot = (
  over: Partial<AvailabilitySlot> & { id: string; date: string },
): AvailabilitySlot => ({
  barberId: 'barber-1',
  startTime: '09:00',
  endTime: '09:30',
  ...over,
});

describe('isBookable', () => {
  it('accepts a free future slot', () => {
    expect(isBookable(slot({ id: 'a', date: '2026-09-01', isAvailable: true }))).toBe(true);
  });

  it('rejects booked and passed slots', () => {
    expect(
      isBookable(slot({ id: 'b', date: '2026-09-01', isAvailable: false, status: 'BOOKED' })),
    ).toBe(false);
    // A slot the API still calls available but has flagged as past must not be offered — booking
    // it is rejected server-side, so showing it only produces a failure at submit.
    expect(isBookable(slot({ id: 'c', date: '2026-09-01', isAvailable: true, isPast: true }))).toBe(
      false,
    );
  });

  it('honours the travel-ready requirement only when asked', () => {
    const notTravelReady = slot({
      id: 'd',
      date: '2026-09-01',
      isAvailable: true,
      availableForMobile: false,
    });
    expect(isBookable(notTravelReady)).toBe(true);
    expect(isBookable(notTravelReady, true)).toBe(false);
  });
});

describe('bookableDays', () => {
  it('offers only days that still have something open', () => {
    const days = bookableDays([
      // fully booked
      slot({ id: '1', date: '2026-09-01', isAvailable: false, status: 'BOOKED' }),
      // entirely in the past
      slot({ id: '2', date: '2026-09-02', isAvailable: false, isPast: true, status: 'PAST' }),
      // has one free time
      slot({ id: '3', date: '2026-09-03', isAvailable: false, status: 'BOOKED' }),
      slot({ id: '4', date: '2026-09-03', isAvailable: true }),
    ]);

    expect(days).toEqual(['2026-09-03']);
  });

  it('returns days in order and without duplicates', () => {
    const days = bookableDays([
      slot({ id: '1', date: '2026-09-05', isAvailable: true }),
      slot({ id: '2', date: '2026-09-03', isAvailable: true }),
      slot({ id: '3', date: '2026-09-03', isAvailable: true }),
    ]);

    expect(days).toEqual(['2026-09-03', '2026-09-05']);
  });

  it('is empty when the barber has nothing open, rather than inventing dates', () => {
    expect(bookableDays([slot({ id: '1', date: '2026-09-01', isAvailable: false })])).toEqual([]);
  });
});

describe('slotsForDay', () => {
  const day = '2026-09-01';
  const slots = [
    slot({ id: 'past', date: day, isAvailable: false, isPast: true, status: 'PAST' }),
    slot({ id: 'booked', date: day, isAvailable: false, status: 'BOOKED' }),
    slot({ id: 'free', date: day, isAvailable: true }),
    slot({ id: 'other-day', date: '2026-09-02', isAvailable: true }),
  ];

  it('keeps booked and passed times so the day reads honestly', () => {
    expect(slotsForDay(slots, day).map((s) => s.id)).toEqual(['past', 'booked', 'free']);
  });

  it('returns nothing when no day is selected', () => {
    expect(slotsForDay(slots, null)).toEqual([]);
  });

  it('hides times that are not travel-ready, but still shows booked and passed ones', () => {
    const mobileSlots = [
      slot({ id: 'booked', date: day, isAvailable: false, status: 'BOOKED' }),
      slot({ id: 'free-no-travel', date: day, isAvailable: true, availableForMobile: false }),
      slot({ id: 'free-travel', date: day, isAvailable: true, availableForMobile: true }),
    ];

    expect(slotsForDay(mobileSlots, day, true).map((s) => s.id)).toEqual(['booked', 'free-travel']);
  });
});
