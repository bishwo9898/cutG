import { describe, expect, it } from 'vitest';

import { groupSlotsByDay, isSpent, slotState, summariseDay, summaryLabel } from './schedule';
import type { AvailabilitySlot } from './types';

const slot = (partial: Partial<AvailabilitySlot> & { id: string }): AvailabilitySlot => ({
  barberId: 'barber-1',
  startTime: '09:00',
  endTime: '09:30',
  ...partial,
});

describe('slotState', () => {
  it('prefers the explicit status the API sends', () => {
    expect(slotState(slot({ id: '1', status: 'BOOKED' }))).toBe('BOOKED');
    expect(slotState(slot({ id: '2', status: 'BLOCKED' }))).toBe('BLOCKED');
  });

  it('reads a PAST status as a free slot, because passing is not a state of its own', () => {
    // The API marks a lapsed opening PAST; it is still an unbooked slot, just a spent one.
    expect(slotState(slot({ id: '3', status: 'PAST', isPast: true }))).toBe('AVAILABLE');
  });

  it('falls back to isAvailable for endpoints that do not send a status', () => {
    expect(slotState(slot({ id: '4', isAvailable: true }))).toBe('AVAILABLE');
    expect(slotState(slot({ id: '5', isAvailable: false }))).toBe('BLOCKED');
  });
});

describe('isSpent', () => {
  it('treats a lapsed opening as history', () => {
    expect(isSpent(slot({ id: '1', status: 'AVAILABLE', isPast: true }))).toBe(true);
  });

  it('keeps a booking visible after its time, because the barber still needs to see who it was', () => {
    expect(isSpent(slot({ id: '2', status: 'BOOKED', isPast: true }))).toBe(false);
  });

  it('leaves anything still to come alone', () => {
    expect(isSpent(slot({ id: '3', status: 'AVAILABLE', isPast: false }))).toBe(false);
  });
});

describe('summariseDay', () => {
  const day = [
    slot({ id: 'a', status: 'AVAILABLE', isPast: true }),
    slot({ id: 'b', status: 'AVAILABLE', isPast: true }),
    slot({ id: 'c', status: 'BOOKED', isPast: true }),
    slot({ id: 'd', status: 'BOOKED', isPast: false }),
    slot({ id: 'e', status: 'AVAILABLE', isPast: false }),
    slot({ id: 'f', status: 'BLOCKED', isPast: false }),
  ];

  it('separates the spent openings from everything still worth looking at', () => {
    const summary = summariseDay(day);
    expect(summary.spent.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(summary.live.map((entry) => entry.id)).toEqual(['c', 'd', 'e', 'f']);
  });

  it('counts only openings a customer could still take', () => {
    // Two of the free slots have already gone by. Counting them told the barber they had five
    // openings when only one was bookable.
    expect(summariseDay(day).open).toBe(1);
    expect(summariseDay(day).booked).toBe(2);
    expect(summariseDay(day).blocked).toBe(1);
  });

  it('handles a day that has not started and a day that is over', () => {
    const morning = summariseDay([slot({ id: 'x', status: 'AVAILABLE', isPast: false })]);
    expect(morning.spent).toHaveLength(0);
    expect(morning.live).toHaveLength(1);

    const finished = summariseDay([slot({ id: 'y', status: 'AVAILABLE', isPast: true })]);
    expect(finished.live).toHaveLength(0);
    expect(finished.spent).toHaveLength(1);
    expect(finished.open).toBe(0);
  });

  it('preserves the order the API returned within each group', () => {
    const ordered = summariseDay([
      slot({ id: '1', status: 'AVAILABLE', isPast: true }),
      slot({ id: '2', status: 'AVAILABLE', isPast: false }),
      slot({ id: '3', status: 'AVAILABLE', isPast: true }),
    ]);
    expect(ordered.spent.map((entry) => entry.id)).toEqual(['1', '3']);
  });
});

describe('summaryLabel', () => {
  it('names only what the day actually has', () => {
    expect(summaryLabel(summariseDay([slot({ id: 'a', status: 'BOOKED' })]))).toBe('1 booked');
    expect(
      summaryLabel(
        summariseDay([
          slot({ id: 'a', status: 'BOOKED' }),
          slot({ id: 'b', status: 'AVAILABLE' }),
          slot({ id: 'c', status: 'BLOCKED' }),
        ]),
      ),
    ).toBe('1 booked · 1 open · 1 blocked');
  });

  it('says so plainly when there is nothing left', () => {
    expect(summaryLabel(summariseDay([]))).toBe('Nothing scheduled');
    expect(summaryLabel(summariseDay([slot({ id: 'a', status: 'AVAILABLE', isPast: true })]))).toBe(
      'Nothing scheduled',
    );
  });
});

describe('groupSlotsByDay', () => {
  const on = (id: string, date: string, startTime: string): AvailabilitySlot => ({
    id,
    barberId: 'b',
    slotDate: date,
    startTime,
    endTime: startTime,
  });

  it('splits a multi-day run into days, in order', () => {
    const days = groupSlotsByDay([
      on('1', '2026-09-07', '09:00'),
      on('2', '2026-09-07', '09:30'),
      on('3', '2026-09-08', '09:00'),
    ]);
    expect(days).toHaveLength(2);
    expect(days[0]?.date).toBe('2026-09-07');
    expect(days[0]?.slots.map((s) => s.id)).toEqual(['1', '2']);
    expect(days[1]?.slots.map((s) => s.id)).toEqual(['3']);
  });

  it('keeps a single day as one group', () => {
    expect(groupSlotsByDay([on('1', '2026-09-07', '09:00')])).toHaveLength(1);
    expect(groupSlotsByDay([])).toEqual([]);
  });

  it('reads the older `date` field when `slotDate` is absent', () => {
    const legacy: AvailabilitySlot = {
      id: '1',
      barberId: 'b',
      date: '2026-09-07',
      startTime: '09:00',
      endTime: '09:30',
    };
    expect(groupSlotsByDay([legacy])[0]?.date).toBe('2026-09-07');
  });

  it('drops a slot with no day rather than filing it under the previous one', () => {
    const orphan: AvailabilitySlot = {
      id: 'x',
      barberId: 'b',
      startTime: '09:00',
      endTime: '09:30',
    };
    expect(groupSlotsByDay([on('1', '2026-09-07', '09:00'), orphan])[0]?.slots).toHaveLength(1);
  });
});
