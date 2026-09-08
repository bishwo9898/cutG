import { describe, expect, it } from 'vitest';

import { patchAppointmentStatus } from './appointmentCache';

describe('patchAppointmentStatus', () => {
  it("updates the appointment in today's list", () => {
    const today = {
      appointments: [
        { id: 'a', status: 'PENDING' },
        { id: 'b', status: 'PENDING' },
      ],
    };
    const next = patchAppointmentStatus(today, 'b', 'CONFIRMED');
    expect(next.appointments.map((x) => x.status)).toEqual(['PENDING', 'CONFIRMED']);
  });

  it('reaches into every page of an infinite list', () => {
    const paged = {
      pages: [
        { appointments: [{ id: 'a', status: 'PENDING' }] },
        { appointments: [{ id: 'b', status: 'PENDING' }] },
      ],
    };
    const next = patchAppointmentStatus(paged, 'b', 'CANCELLED');
    expect(next.pages[0]?.appointments[0]?.status).toBe('PENDING');
    expect(next.pages[1]?.appointments[0]?.status).toBe('CANCELLED');
  });

  it('updates a lone appointment, as the detail screen holds it', () => {
    expect(patchAppointmentStatus({ id: 'a', status: 'PENDING' }, 'a', 'CONFIRMED')).toEqual({
      id: 'a',
      status: 'CONFIRMED',
    });
  });

  it('updates the booking named inside a calendar slot', () => {
    // The barber's calendar shows the status on the slot, not on an appointment row.
    const day = {
      slots: [
        { id: 's1', appointmentSummary: { appointmentId: 'a', status: 'PENDING' } },
        { id: 's2' },
      ],
    };
    const next = patchAppointmentStatus(day, 'a', 'CONFIRMED');
    expect(next.slots[0]?.appointmentSummary?.status).toBe('CONFIRMED');
  });

  it('returns the very same object when nothing matched', () => {
    // Identity matters: a new object here would re-render every cached list on every mutation.
    const cached = { appointments: [{ id: 'a', status: 'PENDING' }] };
    expect(patchAppointmentStatus(cached, 'missing', 'CONFIRMED')).toBe(cached);
    expect(patchAppointmentStatus(cached, 'a', 'PENDING')).toBe(cached);
  });

  it('keeps untouched pages and rows referentially stable', () => {
    const firstPage = { appointments: [{ id: 'a', status: 'PENDING' }] };
    const paged = { pages: [firstPage, { appointments: [{ id: 'b', status: 'PENDING' }] }] };
    const next = patchAppointmentStatus(paged, 'b', 'CONFIRMED');
    expect(next.pages[0]).toBe(firstPage);
  });

  it('leaves every other field on the appointment alone', () => {
    const cached = {
      appointments: [{ id: 'a', status: 'PENDING', clientName: 'Ada', price: 25 }],
    };
    expect(patchAppointmentStatus(cached, 'a', 'CONFIRMED').appointments[0]).toEqual({
      id: 'a',
      status: 'CONFIRMED',
      clientName: 'Ada',
      price: 25,
    });
  });

  it('survives whatever else is in the cache without throwing on the way to a screen', () => {
    expect(patchAppointmentStatus(null, 'a', 'CONFIRMED')).toBeNull();
    expect(patchAppointmentStatus(undefined, 'a', 'CONFIRMED')).toBeUndefined();
    expect(patchAppointmentStatus('text', 'a', 'CONFIRMED')).toBe('text');
    expect(patchAppointmentStatus({ pages: null }, 'a', 'CONFIRMED')).toEqual({ pages: null });
    expect(patchAppointmentStatus({ appointments: null }, 'a', 'CONFIRMED')).toEqual({
      appointments: null,
    });
  });
});
