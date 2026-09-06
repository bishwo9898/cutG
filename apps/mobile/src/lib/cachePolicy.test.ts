import { describe, expect, it } from 'vitest';

import { cacheBuster, shouldPersistQuery } from './cachePolicy';

const query = (
  queryKey: readonly unknown[],
  status = 'success',
): Parameters<typeof shouldPersistQuery>[0] => ({
  queryKey,
  state: { status },
});

describe('shouldPersistQuery', () => {
  it('keeps the lists and profiles that make a cold start feel instant', () => {
    expect(shouldPersistQuery(query(['barber', 'appointments', 'paged', {}]))).toBe(true);
    expect(shouldPersistQuery(query(['barber', 'profile']))).toBe(true);
    expect(shouldPersistQuery(query(['barbers', 'search', 'paged', {}]))).toBe(true);
    expect(shouldPersistQuery(query(['notifications']))).toBe(true);
  });

  it('never stores a live location ping', () => {
    // Refetched every five seconds while the barber drives. Restored from disk it would put a
    // stale pin on the customer's map, which reads as "your barber has not moved in an hour".
    expect(shouldPersistQuery(query(['appointments', 'barber-location', 'abc']))).toBe(false);
  });

  it('never stores payment state or address autocomplete', () => {
    expect(shouldPersistQuery(query(['payment', 'intent', 'abc']))).toBe(false);
    expect(shouldPersistQuery(query(['market-location-search', '221b baker']))).toBe(false);
  });

  it('drops anything that did not succeed', () => {
    expect(shouldPersistQuery(query(['barber', 'profile'], 'error'))).toBe(false);
    expect(shouldPersistQuery(query(['barber', 'profile'], 'pending'))).toBe(false);
  });
});

describe('cacheBuster', () => {
  it('separates two accounts sharing one phone', () => {
    // A restored cache across this boundary would show one person the other's customers.
    expect(cacheBuster('user_barber', '0.2.0')).not.toBe(cacheBuster('user_client', '0.2.0'));
  });

  it('separates signed-out from any signed-in account', () => {
    expect(cacheBuster(null, '0.2.0')).not.toBe(cacheBuster('user_barber', '0.2.0'));
    expect(cacheBuster(undefined, '0.2.0')).toBe(cacheBuster(null, '0.2.0'));
  });

  it('discards the cache when the app version changes, so old shapes cannot hydrate new screens', () => {
    expect(cacheBuster('user_barber', '0.2.0')).not.toBe(cacheBuster('user_barber', '0.3.0'));
  });

  it('is stable for the same account and build', () => {
    expect(cacheBuster('user_barber', '0.2.0')).toBe(cacheBuster('user_barber', '0.2.0'));
  });
});
