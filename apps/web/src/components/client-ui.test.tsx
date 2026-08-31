import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

// vitest is not configured with globals, so Testing Library's automatic cleanup never registers
// and each render would otherwise stack up in the same document.
afterEach(cleanup);

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

  it('shows booked and passed times struck through instead of hiding them', () => {
    const onSelect = vi.fn();
    const withUnavailable: PublicSlot[] = [
      {
        id: 'past',
        date: '2026-07-14',
        startTime: '08:00',
        endTime: '08:30',
        isAvailable: false,
        isPast: true,
        status: 'PAST',
      },
      {
        id: 'booked',
        date: '2026-07-14',
        startTime: '10:00',
        endTime: '10:30',
        isAvailable: false,
        status: 'BOOKED',
      },
      { id: 'free', date: '2026-07-14', startTime: '11:00', endTime: '11:30', isAvailable: true },
    ];

    render(<SlotPicker durationMinutes={30} onSelect={onSelect} slots={withUnavailable} />);

    // All three stay on the grid so the day reads honestly...
    const past = screen.getByRole('button', { name: /8:00 AM/i });
    const booked = screen.getByRole('button', { name: /10:00 AM/i });
    const free = screen.getByRole('button', { name: /11:00 AM/i });

    // ...but only the free one can be chosen.
    expect((past as HTMLButtonElement).disabled).toBe(true);
    expect((booked as HTMLButtonElement).disabled).toBe(true);
    expect((free as HTMLButtonElement).disabled).toBe(false);

    expect(past.textContent).toContain('Passed');
    expect(booked.textContent).toContain('Booked');
    expect(booked.className).toContain('is-booked');
    expect(past.className).toContain('is-past');

    fireEvent.click(booked);
    fireEvent.click(past);
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(free);
    expect(onSelect).toHaveBeenCalledWith(withUnavailable[2]);
  });

  it('counts only bookable times and skips days with nothing left', () => {
    const onSelect = vi.fn();
    const slotsWithFullDay: PublicSlot[] = [
      {
        id: 'b1',
        date: '2026-07-14',
        startTime: '09:00',
        endTime: '09:30',
        isAvailable: false,
        status: 'BOOKED',
      },
      {
        id: 'b2',
        date: '2026-07-14',
        startTime: '09:30',
        endTime: '10:00',
        isAvailable: false,
        status: 'BOOKED',
      },
      { id: 'open', date: '2026-07-15', startTime: '09:00', endTime: '09:30', isAvailable: true },
    ];

    render(<SlotPicker durationMinutes={30} onSelect={onSelect} slots={slotsWithFullDay} />);

    // 14 Jul is fully booked, so it is not offered as a day to navigate to at all.
    expect(screen.queryByRole('button', { name: /Tue 14 Jul/i })).toBeNull();
    expect(screen.getByRole('button', { name: /Wed 15 Jul/i })).toBeTruthy();
    expect(screen.getByText('1 time available')).toBeTruthy();
  });
});
