import type { AvailabilitySlot } from './types';

/**
 * Slot list helpers, kept out of the screen so they can be tested directly — the mobile app has no
 * component-test setup, and this is the logic worth pinning down.
 *
 * The rules mirror the web picker: a time is bookable only if the API says it is free *and* it has
 * not already passed, and booked or passed times are still shown (struck through) rather than
 * silently dropped, so a day does not appear to have arbitrary holes in it.
 */

export const slotDate = (slot: AvailabilitySlot): string => slot.date ?? slot.slotDate ?? '';

export const isBookable = (slot: AvailabilitySlot, requireTravelReady = false): boolean => {
  const free = (slot.isAvailable ?? slot.status === 'AVAILABLE') && slot.isPast !== true;
  if (!free) return false;
  return !requireTravelReady || slot.availableForMobile === true;
};

/**
 * The days worth offering in the date strip: those with at least one time still bookable.
 *
 * This deliberately does not return a fixed run of dates. Doing that advertised the barber's
 * closed days and any day whose times had all passed, and only revealed the problem after a tap.
 */
export const bookableDays = (slots: AvailabilitySlot[], requireTravelReady = false): string[] =>
  [...new Set(slots.filter((slot) => isBookable(slot, requireTravelReady)).map(slotDate))]
    .filter((value) => value.length > 0)
    .sort();

/** Everything to render for one day: bookable times, plus booked/passed ones to strike through. */
export const slotsForDay = (
  slots: AvailabilitySlot[],
  day: string | null,
  requireTravelReady = false,
): AvailabilitySlot[] =>
  slots.filter((slot) => {
    if (day === null || slotDate(slot) !== day) return false;
    const free = (slot.isAvailable ?? slot.status === 'AVAILABLE') && slot.isPast !== true;
    if (!free) return true;
    return !requireTravelReady || slot.availableForMobile === true;
  });
