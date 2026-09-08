import { listFromResponse } from './types';
import type { Paginated, PublicBarber } from './types';

/**
 * Finds a barber the customer has already seen, so their profile can open on something.
 *
 * Tapping a card used to show a full-screen "Loading profile", even though the card carried the
 * name, photo, rating and price a moment earlier — four requests fired and the customer watched a
 * placeholder. Every field a list row lacks is optional on `BarberProfile`, so a row is a valid
 * partial profile: the header paints instantly and the bio, services and reviews fill in behind it.
 */

/** React Query holds infinite results as `{ pages: [...] }` and plain ones as a single payload. */
const pagesOf = (cached: unknown): Paginated<unknown>[] => {
  if (cached === null || typeof cached !== 'object') return [];
  const infinite = (cached as { pages?: unknown }).pages;
  if (Array.isArray(infinite)) return infinite as Paginated<unknown>[];
  return [cached as Paginated<unknown>];
};

/**
 * Distinguishes a full list row from the marketplace's differently shaped result, which carries
 * capabilities instead of these fields and would be missing most of what the header draws.
 */
const isPublicBarber = (value: unknown): value is PublicBarber => {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<PublicBarber>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.businessName === 'string' &&
    typeof candidate.subscriptionTier === 'string' &&
    typeof candidate.averageRating === 'number'
  );
};

export const findBarberInCache = (
  cachedLists: readonly unknown[],
  barberId: string,
): PublicBarber | undefined => {
  if (barberId.length === 0) return undefined;
  for (const cached of cachedLists) {
    for (const page of pagesOf(cached)) {
      for (const row of listFromResponse(page)) {
        if (isPublicBarber(row) && row.id === barberId) return row;
      }
    }
  }
  return undefined;
};

/** True when this barber is in the customer's saved list, whatever shape it came back in. */
export const isBarberSaved = (savedList: unknown, barberId: string): boolean =>
  findBarberInCache([savedList], barberId) !== undefined;

/**
 * Adds or removes a barber from the cached saved list, so the heart fills the moment it is
 * pressed rather than after a round trip and the refetch behind it.
 */
export const toggleSavedBarber = <T>(cached: T, barber: PublicBarber, save: boolean): T => {
  if (cached === null || typeof cached !== 'object') return cached;
  const record = cached as Record<string, unknown>;
  const key = (['barbers', 'data', 'items'] as const).find((candidate) =>
    Array.isArray(record[candidate]),
  );
  if (key === undefined) return cached;

  const rows = record[key] as unknown[];
  const present = rows.some((row) => isPublicBarber(row) && row.id === barber.id);
  if (present === save) return cached;

  const next = save
    ? [barber, ...rows]
    : rows.filter((row) => !(isPublicBarber(row) && row.id === barber.id));
  return { ...record, [key]: next } as T;
};
