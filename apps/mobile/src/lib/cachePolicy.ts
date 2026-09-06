/**
 * What is worth keeping on disk between launches, and what must never be.
 *
 * The query cache lives only in memory today, so every cold start shows a spinner on every screen
 * even when the answer has not changed since this morning. Persisting it makes the app open on
 * yesterday's data and quietly revalidate — but only some of it should survive that long.
 */

/**
 * Query keys whose first segment marks data that is worthless or wrong once stored.
 *
 * - `barber-location` is a GPS ping refetched every five seconds while a barber drives. A restored
 *   one would put a stale pin on the customer's map, which is worse than no pin.
 * - `market-location-search` is address autocomplete: a keystroke's worth of suggestions, never
 *   looked at twice.
 * - `payment` covers Stripe intents and client secrets. They expire, and a restored one would fail
 *   at the worst possible moment — mid-checkout.
 */
const VOLATILE_KEYS = new Set(['barber-location', 'market-location-search', 'payment']);

/** `['appointments', 'barber-location', id]` — the marker is not always first. */
const isVolatile = (queryKey: readonly unknown[]): boolean =>
  queryKey.some((segment) => typeof segment === 'string' && VOLATILE_KEYS.has(segment));

export type PersistableQuery = {
  queryKey: readonly unknown[];
  state: { status: string };
};

/**
 * Only successful, non-volatile queries are written out. A failed query has no data worth keeping,
 * and restoring a pending one would leave a screen waiting on a request that no longer exists.
 */
export const shouldPersistQuery = (query: PersistableQuery): boolean =>
  query.state.status === 'success' && !isVolatile(query.queryKey);

/**
 * The cache is keyed to whoever was signed in when it was written.
 *
 * Two accounts share a phone more often than you would think — a barber checking their own
 * bookings on the shop tablet, then a customer borrowing it. Restoring across that boundary would
 * show one person the other's customers, names and phone numbers. A changed buster makes the
 * persisted cache unreadable rather than merely stale, so there is no path where it can leak.
 *
 * The app version is in here too: a release that changes a response shape must not hydrate the old
 * shape into new screens.
 */
export const cacheBuster = (userId: string | null | undefined, appVersion: string): string =>
  `${appVersion}:${userId ?? 'signed-out'}`;
