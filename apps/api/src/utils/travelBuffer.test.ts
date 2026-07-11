import { describe, expect, it } from 'vitest';

import { calculateTravelBufferSlots, getTravelBufferSlotTimes } from './travelBuffer';

describe('travel buffers', () => {
  it.each([
    [0, 30, 0],
    [5, 30, 1],
    [30, 30, 1],
    [31, 30, 2],
    [61, 30, 3],
    [300, 30, 4],
    [50, 45, 2],
  ])('maps %i travel minutes with %i minute slots to %i buffers', (travel, duration, expected) => {
    expect(calculateTravelBufferSlots(travel, duration)).toBe(expected);
  });

  it('walks backward chronologically and crosses midnight safely', () => {
    expect(getTravelBufferSlotTimes('2026-08-03', '00:30', 2, 30)).toEqual([
      { date: '2026-08-02', startTime: '23:30', endTime: '00:00' },
      { date: '2026-08-03', startTime: '00:00', endTime: '00:30' },
    ]);
  });
});
