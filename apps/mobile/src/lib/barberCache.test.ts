import { describe, expect, it } from 'vitest';

import { findBarberInCache, isBarberSaved, toggleSavedBarber } from './barberCache';
import type { PublicBarber } from './types';

const barber = (id: string, businessName: string): PublicBarber => ({
  id,
  businessName,
  bio: null,
  profilePhotoUrl: null,
  city: 'Danville',
  state: 'KY',
  averageRating: 4.5,
  totalReviews: 12,
  isVerified: true,
  subscriptionTier: 'PREMIUM',
  lowestServicePrice: 15,
  serviceCategories: [],
  nextAvailableSlot: null,
});

describe('findBarberInCache', () => {
  it('finds a barber inside a paged search result', () => {
    const paged = {
      pages: [{ barbers: [barber('a', 'Alpha Cuts')] }, { barbers: [barber('b', 'Beta Fades')] }],
    };
    expect(findBarberInCache([paged], 'b')?.businessName).toBe('Beta Fades');
  });

  it('finds a barber in a plain, un-paged list such as saved barbers', () => {
    expect(findBarberInCache([{ barbers: [barber('c', 'Gamma')] }], 'c')?.businessName).toBe(
      'Gamma',
    );
  });

  it('searches across every cached list, not just the first', () => {
    const saved = { barbers: [barber('a', 'Alpha Cuts')] };
    const search = { pages: [{ barbers: [barber('z', 'Zeta')] }] };
    expect(findBarberInCache([saved, search], 'z')?.businessName).toBe('Zeta');
  });

  it('returns nothing when the barber has not been seen', () => {
    expect(findBarberInCache([{ barbers: [barber('a', 'Alpha')] }], 'missing')).toBeUndefined();
    expect(findBarberInCache([], 'a')).toBeUndefined();
    expect(findBarberInCache([{ barbers: [barber('a', 'Alpha')] }], '')).toBeUndefined();
  });

  it('ignores the marketplace shape, which cannot fill the header', () => {
    // Marketplace results carry `capabilities` and no subscriptionTier; using one as a profile
    // would paint a header with holes in it.
    const marketplace = {
      pages: [{ barbers: [{ id: 'm', businessName: 'Market', capabilities: { verified: true } }] }],
    };
    expect(findBarberInCache([marketplace], 'm')).toBeUndefined();
  });

  it('survives junk in the cache rather than throwing on the way to a screen', () => {
    expect(findBarberInCache([null, undefined, 42, 'text', { pages: null }], 'a')).toBeUndefined();
  });
});

describe('isBarberSaved', () => {
  it('recognises a barber in the saved list', () => {
    const saved = { barbers: [barber('a', 'Alpha')] };
    expect(isBarberSaved(saved, 'a')).toBe(true);
    expect(isBarberSaved(saved, 'b')).toBe(false);
  });

  it('says no rather than throwing before the list has loaded', () => {
    expect(isBarberSaved(undefined, 'a')).toBe(false);
    expect(isBarberSaved({ barbers: [] }, 'a')).toBe(false);
  });
});

describe('toggleSavedBarber', () => {
  const alpha = barber('a', 'Alpha');
  const beta = barber('b', 'Beta');

  it('puts a newly saved barber at the top, where the customer will look for it', () => {
    const next = toggleSavedBarber({ barbers: [beta] }, alpha, true);
    expect(next.barbers.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('removes an unsaved barber', () => {
    const next = toggleSavedBarber({ barbers: [alpha, beta] }, alpha, false);
    expect(next.barbers.map((x) => x.id)).toEqual(['b']);
  });

  it('does nothing when the list already agrees, and keeps the same reference', () => {
    const saved = { barbers: [alpha] };
    expect(toggleSavedBarber(saved, alpha, true)).toBe(saved);
    const empty = { barbers: [] };
    expect(toggleSavedBarber(empty, alpha, false)).toBe(empty);
  });

  it('leaves a cache it does not understand alone', () => {
    expect(toggleSavedBarber(null, alpha, true)).toBeNull();
    expect(toggleSavedBarber({ nothing: true }, alpha, true)).toEqual({ nothing: true });
  });
});
