import type { AvailabilitySlot } from './types';

export type SlotState = 'AVAILABLE' | 'BOOKED' | 'BLOCKED';

/**
 * The state to draw a slot in.
 *
 * `status` is authoritative when the API sends it; `isAvailable` is the older shape and is still
 * what some endpoints answer with. A booked slot keeps its identity once the time has gone by,
 * because the barber still needs to see who it was — only a *free* slot becomes history.
 */
export const slotState = (slot: AvailabilitySlot): SlotState => {
  if (slot.status === 'BOOKED') return 'BOOKED';
  if (slot.status === 'AVAILABLE') return 'AVAILABLE';
  if (slot.status === 'BLOCKED') return 'BLOCKED';
  if (slot.status === 'PAST') return 'AVAILABLE';
  return slot.isAvailable === true ? 'AVAILABLE' : 'BLOCKED';
};

/** A free slot whose time has passed: capacity nobody can book any more. */
export const isSpent = (slot: AvailabilitySlot): boolean =>
  slot.isPast === true && slotState(slot) !== 'BOOKED';

export type DaySummary = {
  /** Free slots whose time has gone by. Hidden behind a disclosure. */
  spent: AvailabilitySlot[];
  /** Everything the barber can still act on, plus bookings that have already happened. */
  live: AvailabilitySlot[];
  booked: number;
  open: number;
  blocked: number;
};

/**
 * Splits a day into what still matters and what is only history.
 *
 * The calendar used to render the day in order, so opening it after lunch meant scrolling past a
 * column of struck-through mornings to reach anything actionable — every time, every day. The
 * spent slots are not deleted, because a barber does sometimes want to look back at the morning;
 * they are just not what the screen should open on.
 */
export const summariseDay = (slots: readonly AvailabilitySlot[]): DaySummary => {
  const spent: AvailabilitySlot[] = [];
  const live: AvailabilitySlot[] = [];
  let booked = 0;
  let open = 0;
  let blocked = 0;

  for (const slot of slots) {
    const state = slotState(slot);
    if (state === 'BOOKED') booked += 1;
    else if (state === 'BLOCKED') blocked += 1;
    // Only a slot that is still bookable counts as an opening. Counting spent ones told the
    // barber they had availability that no customer could actually take.
    else if (!isSpent(slot)) open += 1;

    if (isSpent(slot)) spent.push(slot);
    else live.push(slot);
  }

  return { spent, live, booked, open, blocked };
};

/** "2 booked · 5 open" — the shape of the day in one line. */
export const summaryLabel = (summary: DaySummary): string => {
  const parts: string[] = [];
  if (summary.booked > 0) parts.push(`${summary.booked} booked`);
  if (summary.open > 0) parts.push(`${summary.open} open`);
  if (summary.blocked > 0) parts.push(`${summary.blocked} blocked`);
  return parts.length === 0 ? 'Nothing scheduled' : parts.join(' · ');
};
