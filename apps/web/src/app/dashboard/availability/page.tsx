'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CalendarCheck, CheckCircle2, Clock3, RefreshCw, Save, Trash2, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Notice } from '@/components/notice';
import { EmptyState, LoadingState } from '@/components/query-states';
import { browserApi } from '@/lib/browser-api';
import type { ScheduleEntry } from '@/lib/contracts';
import { errorMessage } from '@/lib/errors';

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const defaultSchedule = (): ScheduleEntry[] =>
  dayNames.map((dayName, index) => ({
    dayOfWeek: index + 1,
    dayName,
    startTime: '09:00',
    endTime: '17:00',
    slotDurationMinutes: 30,
    isActive: index < 5,
  }));

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

type BlockedDate = { id: string; date: string; reason: string | null };
type PrivateSlot = {
  id: string;
  date: string;
  dayName: string;
  startTime: string;
  endTime: string;
  status: 'AVAILABLE' | 'BOOKED' | 'BLOCKED';
  appointmentSummary?: {
    appointmentId: string;
    customerName: string;
    serviceName: string;
    status: string;
  };
};

export default function AvailabilityPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(defaultSchedule);
  const [blockedDate, setBlockedDate] = useState('');
  const [reason, setReason] = useState('');
  const [range, setRange] = useState({
    startDate: isoDate(new Date()),
    endDate: isoDate(new Date(Date.now() + 13 * 86_400_000)),
  });
  const scheduleQuery = useQuery({
    queryKey: ['schedule'],
    queryFn: () => browserApi.get<{ schedule: ScheduleEntry[] }>('/barbers/me/schedule'),
  });
  const blockedDates = useQuery({
    queryKey: ['blocked-dates'],
    queryFn: () => browserApi.get<{ blockedDates: BlockedDate[] }>('/barbers/me/blocked-dates'),
  });
  const slots = useQuery({
    queryKey: ['slots', range],
    queryFn: () =>
      browserApi.get<{
        slots: PrivateSlot[];
        summary: { totalSlots: number; available: number; booked: number; blocked: number };
      }>(`/barbers/me/slots?startDate=${range.startDate}&endDate=${range.endDate}`),
  });

  useEffect(() => {
    if (scheduleQuery.data !== undefined) {
      const byDay = new Map(scheduleQuery.data.schedule.map((entry) => [entry.dayOfWeek, entry]));
      setSchedule(
        defaultSchedule().map((entry) => ({
          ...entry,
          ...(byDay.get(entry.dayOfWeek) ?? {}),
        })),
      );
    }
  }, [scheduleQuery.data]);

  const saveSchedule = useMutation({
    mutationFn: () =>
      browserApi.put('/barbers/me/schedule', {
        schedule: schedule.map((entry) => ({
          dayOfWeek: entry.dayOfWeek,
          startTime: entry.startTime,
          endTime: entry.endTime,
          slotDurationMinutes: entry.slotDurationMinutes,
          isActive: entry.isActive,
        })),
      }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['schedule'] }),
  });
  const generate = useMutation({
    mutationFn: () =>
      browserApi.post<{ generated: number; skipped: number }>('/barbers/me/slots/generate', range),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['slots'] }),
  });
  const block = useMutation({
    mutationFn: () =>
      browserApi.post('/barbers/me/blocked-dates', {
        date: blockedDate,
        ...(reason.trim() === '' ? {} : { reason }),
      }),
    onSuccess: async () => {
      setBlockedDate('');
      setReason('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['blocked-dates'] }),
        queryClient.invalidateQueries({ queryKey: ['slots'] }),
      ]);
    },
  });
  const unblock = useMutation({
    mutationFn: (date: string) => browserApi.delete(`/barbers/me/blocked-dates/${date}`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['blocked-dates'] }),
        queryClient.invalidateQueries({ queryKey: ['slots'] }),
      ]);
    },
  });

  const updateSchedule = <K extends keyof ScheduleEntry>(
    index: number,
    key: K,
    value: ScheduleEntry[K],
  ): void => {
    setSchedule((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [key]: value } : entry,
      ),
    );
  };

  if (scheduleQuery.isPending) {
    return <LoadingState />;
  }

  const slotsByDate = new Map<string, PrivateSlot[]>();
  for (const slot of slots.data?.slots ?? []) {
    slotsByDate.set(slot.date, [...(slotsByDate.get(slot.date) ?? []), slot]);
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Availability</h1>
          <p>Keep the week tight, set exceptions fast, and generate clean bookable time.</p>
        </div>
      </div>
      <section className="two-column availability-layout">
        <div className="panel availability-panel">
          <div className="panel-header">
            <div>
              <h2>Weekly schedule</h2>
              <p className="panel-description">Toggle days on and off without leaving the page.</p>
            </div>
            <button
              className="button button-primary"
              disabled={saveSchedule.isPending}
              onClick={() => saveSchedule.mutate()}
              type="button"
            >
              <Save size={16} />
              Save week
            </button>
          </div>
          <div className="panel-body">
            {saveSchedule.isError && <Notice>{errorMessage(saveSchedule.error)}</Notice>}
            {saveSchedule.isSuccess && <Notice tone="success">Weekly schedule saved.</Notice>}
            <div className="schedule-summary">
              <span className="badge badge-success">
                {schedule.filter((entry) => entry.isActive).length} active days
              </span>
              <span className="badge badge-warning">
                {schedule.filter((entry) => !entry.isActive).length} closed days
              </span>
            </div>
            <div className="schedule-list">
              {schedule.map((entry, index) => (
                <div className="schedule-row" key={entry.dayOfWeek}>
                  <label className="toggle-label">
                    <input
                      checked={entry.isActive}
                      onChange={(event) => updateSchedule(index, 'isActive', event.target.checked)}
                      type="checkbox"
                    />
                    {entry.dayName}
                  </label>
                  <input
                    aria-label={`${entry.dayName} start time`}
                    className="input"
                    disabled={!entry.isActive}
                    onChange={(event) => updateSchedule(index, 'startTime', event.target.value)}
                    type="time"
                    value={entry.startTime}
                  />
                  <input
                    aria-label={`${entry.dayName} end time`}
                    className="input"
                    disabled={!entry.isActive}
                    onChange={(event) => updateSchedule(index, 'endTime', event.target.value)}
                    type="time"
                    value={entry.endTime}
                  />
                  <select
                    aria-label={`${entry.dayName} slot duration`}
                    className="select"
                    disabled={!entry.isActive}
                    onChange={(event) =>
                      updateSchedule(
                        index,
                        'slotDurationMinutes',
                        Number(event.target.value) as ScheduleEntry['slotDurationMinutes'],
                      )
                    }
                    value={entry.slotDurationMinutes}
                  >
                    {[15, 30, 45, 60].map((duration) => (
                      <option key={duration} value={duration}>
                        {duration} min
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="form-stack">
          <section className="panel availability-panel">
            <div className="panel-header">
              <div>
                <h2>Generate slots</h2>
                <p className="panel-description">
                  Use a date range, then build time blocks in one pass.
                </p>
              </div>
            </div>
            <div className="panel-body form-stack">
              {generate.isError && <Notice>{errorMessage(generate.error)}</Notice>}
              {generate.data !== undefined && (
                <Notice tone="success">
                  Added {generate.data.generated} slots. Skipped {generate.data.skipped} existing
                  slots.
                </Notice>
              )}
              <div className="form-row">
                <div className="field">
                  <label htmlFor="startDate">From</label>
                  <input
                    id="startDate"
                    className="input"
                    onChange={(event) => setRange({ ...range, startDate: event.target.value })}
                    type="date"
                    value={range.startDate}
                  />
                </div>
                <div className="field">
                  <label htmlFor="endDate">To</label>
                  <input
                    id="endDate"
                    className="input"
                    onChange={(event) => setRange({ ...range, endDate: event.target.value })}
                    type="date"
                    value={range.endDate}
                  />
                </div>
              </div>
              <button
                className="button button-primary"
                disabled={generate.isPending}
                onClick={() => generate.mutate()}
                type="button"
              >
                <RefreshCw size={16} />
                {generate.isPending ? 'Generating...' : 'Generate availability'}
              </button>
              <div className="toolbar">
                <span className="badge">{slots.data?.summary.totalSlots ?? 0} total</span>
                <span className="badge badge-success">
                  {slots.data?.summary.available ?? 0} available
                </span>
                <span className="badge badge-warning">
                  {slots.data?.summary.booked ?? 0} booked
                </span>
                <span className="badge badge-danger">
                  {slots.data?.summary.blocked ?? 0} blocked
                </span>
              </div>
            </div>
          </section>
          <section className="panel availability-panel">
            <div className="panel-header">
              <div>
                <h2>Block a date</h2>
                <p className="panel-description">Mark closures without disturbing booked slots.</p>
              </div>
            </div>
            <div className="panel-body form-stack">
              {block.isError && <Notice>{errorMessage(block.error)}</Notice>}
              <div className="field">
                <label htmlFor="blockedDate">Date</label>
                <input
                  id="blockedDate"
                  className="input"
                  min={isoDate(new Date())}
                  onChange={(event) => setBlockedDate(event.target.value)}
                  type="date"
                  value={blockedDate}
                />
              </div>
              <div className="field">
                <label htmlFor="reason">Reason (optional)</label>
                <input
                  id="reason"
                  className="input"
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Vacation, holiday, personal day"
                  value={reason}
                />
              </div>
              <button
                className="button button-secondary"
                disabled={blockedDate === '' || block.isPending}
                onClick={() => block.mutate()}
                type="button"
              >
                <Ban size={16} />
                Block date
              </button>
              {(blockedDates.data?.blockedDates.length ?? 0) === 0 ? (
                <EmptyState
                  title="No upcoming closures"
                  detail="Blocked dates will stay visible here."
                />
              ) : (
                blockedDates.data?.blockedDates.map((item) => (
                  <div
                    className="toolbar"
                    key={item.id}
                    style={{ justifyContent: 'space-between' }}
                  >
                    <span>
                      <strong>{new Date(`${item.date}T12:00:00`).toLocaleDateString()}</strong>
                      {item.reason !== null && (
                        <small style={{ display: 'block' }}>{item.reason}</small>
                      )}
                    </span>
                    <button
                      className="icon-button"
                      disabled={unblock.isPending}
                      onClick={() => unblock.mutate(item.date)}
                      title="Remove blocked date"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
      <section className="panel availability-schedule-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Booking calendar</span>
            <h2>Your generated schedule</h2>
            <p className="panel-description">
              Available, booked, and blocked times for the selected range.
            </p>
          </div>
          <div className="availability-legend" aria-label="Schedule legend">
            <span className="is-available"><CheckCircle2 size={14} /> Available</span>
            <span className="is-booked"><UserRound size={14} /> Booked</span>
            <span className="is-blocked"><Ban size={14} /> Blocked</span>
          </div>
        </div>
        <div className="panel-body availability-days">
          {slots.isPending ? (
            <LoadingState />
          ) : slotsByDate.size === 0 ? (
            <EmptyState
              title="No generated times in this range"
              detail="Choose a date range above and generate availability."
            />
          ) : (
            [...slotsByDate.entries()].map(([slotDate, daySlots]) => (
              <section className="availability-day" key={slotDate}>
                <header>
                  <CalendarCheck size={18} />
                  <div>
                    <strong>
                      {new Date(`${slotDate}T12:00:00`).toLocaleDateString([], {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </strong>
                    <small>{daySlots.length} times</small>
                  </div>
                </header>
                <div className="availability-slot-grid">
                  {daySlots.map((slot) => (
                    <article
                      className={`availability-slot is-${slot.status.toLowerCase()}`}
                      key={slot.id}
                    >
                      <div className="availability-slot-time">
                        <Clock3 size={15} />
                        <strong>{slot.startTime}</strong>
                        <span>– {slot.endTime}</span>
                      </div>
                      {slot.status === 'AVAILABLE' && (
                        <span className="availability-slot-state"><CheckCircle2 size={14} /> Available</span>
                      )}
                      {slot.status === 'BLOCKED' && (
                        <span className="availability-slot-state"><Ban size={14} /> Blocked</span>
                      )}
                      {slot.status === 'BOOKED' && (
                        <>
                          <span className="availability-slot-state"><UserRound size={14} /> Booked</span>
                          <div className="availability-booking-summary">
                            <strong>{slot.appointmentSummary?.customerName ?? 'Customer booking'}</strong>
                            <span>{slot.appointmentSummary?.serviceName ?? 'Service'}</span>
                            <small>
                              {(slot.appointmentSummary?.status ?? 'BOOKED').replaceAll('_', ' ')}
                            </small>
                          </div>
                          {slot.appointmentSummary !== undefined && (
                            <Link
                              className="availability-review-link"
                              href={`/barber/dashboard/appointments/${slot.appointmentSummary.appointmentId}`}
                            >
                              Review booking
                            </Link>
                          )}
                        </>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
