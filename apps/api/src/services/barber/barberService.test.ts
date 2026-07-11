import { describe, expect, it } from 'vitest';

import { BARBER_ALLOWED_TRANSITIONS } from './barberService';

describe('barber appointment transitions', () => {
  it('contains every allowed transition and keeps terminal states closed', () => {
    expect(BARBER_ALLOWED_TRANSITIONS).toEqual({
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['IN_PROGRESS', 'ON_THE_WAY', 'CANCELLED', 'NO_SHOW'],
      ON_THE_WAY: ['ARRIVED'],
      ARRIVED: ['IN_PROGRESS'],
      IN_PROGRESS: ['COMPLETED'],
    });
    expect(BARBER_ALLOWED_TRANSITIONS.COMPLETED).toBeUndefined();
    expect(BARBER_ALLOWED_TRANSITIONS.CANCELLED).toBeUndefined();
    expect(BARBER_ALLOWED_TRANSITIONS.NO_SHOW).toBeUndefined();
  });
});
