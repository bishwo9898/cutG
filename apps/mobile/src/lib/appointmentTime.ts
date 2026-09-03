/**
 * Appointment times are wall-clock times, not instants.
 *
 * `appointments.scheduled_at` is a `timestamptz`, but a booking for 6pm is written as
 * `2026-09-03 18:00:00+00` — the barber's wall clock parked in the UTC slot. The API hands that
 * back as `scheduledAt: '2026-09-03T18:00:00.000Z'`, and everything else in the stack reads it as
 * text: `scheduledDate` and `startTime` are literal slices of that string, and the booking guard
 * compares naive local times.
 *
 * So `new Date(scheduledAt)` is a trap. It produces a real instant, and formatting that instant in
 * the device's zone shifts the appointment by the UTC offset — the barber's Today list said
 * "18:00" while the booking screen for the very same row said "2:00 PM" on a UTC-4 phone.
 *
 * These helpers read the components straight out of the string, so the time shown is the time the
 * barber and the customer agreed on, wherever either of them happens to be standing.
 *
 * This applies only to `scheduledAt`. Timestamps that really are instants — `createdAt`,
 * `confirmedAt`, the journey pings — are genuine UTC and should keep being converted to local.
 */
const PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

export type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export const wallClock = (scheduledAt: string): WallClock | null => {
  const match = PATTERN.exec(scheduledAt);
  if (match === null) return null;
  const [, year, month, day, hour, minute] = match as unknown as string[];
  const parsed = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  };
  if (parsed.month < 1 || parsed.month > 12 || parsed.day < 1 || parsed.day > 31) return null;
  if (parsed.hour > 23 || parsed.minute > 59) return null;
  return parsed;
};

/** `Date` built from the components, so date-fns and friends format the wall clock as written. */
export const wallClockDate = (scheduledAt: string): Date | null => {
  const parts = wallClock(scheduledAt);
  return parts === null
    ? null
    : new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
};

/** "Thu, Sep 3" — the day the appointment sits on, never shifted by the reader's timezone. */
export const formatWallClockDate = (scheduledAt: string): string => {
  const date = wallClockDate(scheduledAt);
  if (date === null) return scheduledAt;
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

/** "6:00 PM" — the time on the barber's clock. */
export const formatWallClockTime = (scheduledAt: string): string => {
  const date = wallClockDate(scheduledAt);
  if (date === null) return scheduledAt;
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};
