import { describe, expect, it } from 'vitest';

import { appointmentStatusClass, bookingStepState, locationFreshness } from './appointment-ui';

describe('appointment UI state', () => {
  it('separates completed, current, and upcoming booking steps', () => {
    expect([0, 1, 2, 3].map((index) => bookingStepState(index, 2))).toEqual([
      'completed',
      'completed',
      'current',
      'upcoming',
    ]);
  });

  it('maps API statuses to stable semantic CSS classes', () => {
    expect(appointmentStatusClass('ON_THE_WAY')).toBe('status-on_the_way');
    expect(appointmentStatusClass('NO_SHOW')).toBe('status-no_show');
  });

  it('uses the documented live-location freshness thresholds', () => {
    expect(locationFreshness(29)).toBe('live');
    expect(locationFreshness(30)).toBe('delayed');
    expect(locationFreshness(60)).toBe('delayed');
    expect(locationFreshness(61)).toBe('reconnecting');
  });
});
