import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SlotPicker } from './client-ui';

import type { PublicSlot } from '@/lib/contracts';

const slots: PublicSlot[] = [
  {
    id: 'morning-slot',
    date: '2026-07-14',
    startTime: '09:00',
    endTime: '09:30',
    isAvailable: true,
  },
  {
    id: 'afternoon-slot',
    date: '2026-07-15',
    startTime: '14:00',
    endTime: '14:30',
    isAvailable: true,
    availableForMobile: true,
  },
];

describe('SlotPicker', () => {
  it('shows one compact day at a time and selects a time', () => {
    const onSelect = vi.fn();

    render(
      <SlotPicker durationMinutes={30} onSelect={onSelect} slots={slots} travelMinutes={15} />,
    );

    expect(screen.getByRole('button', { name: /9:00 AM/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /2:00 PM/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Wed 15 Jul/i }));

    expect(screen.queryByRole('button', { name: /9:00 AM/i })).toBeNull();
    const afternoon = screen.getByRole('button', { name: /2:00 PM/i });
    expect(afternoon.textContent).toContain('Travel-ready');

    fireEvent.click(afternoon);
    expect(onSelect).toHaveBeenCalledWith(slots[1]);
  });
});
