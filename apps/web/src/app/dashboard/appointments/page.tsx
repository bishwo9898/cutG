'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Play, UserX, X } from 'lucide-react';
import { useState } from 'react';

import { Notice } from '@/components/notice';
import { EmptyState, ErrorState, LoadingState } from '@/components/query-states';
import { browserApi } from '@/lib/browser-api';
import type { Appointment } from '@/lib/contracts';
import { errorMessage } from '@/lib/errors';

type Response = {
  appointments: Appointment[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

const transitions: Record<string, Array<{ status: string; label: string; icon: typeof Check }>> = {
  PENDING: [
    { status: 'CONFIRMED', label: 'Confirm', icon: Check },
    { status: 'CANCELLED', label: 'Cancel', icon: X },
  ],
  CONFIRMED: [
    { status: 'IN_PROGRESS', label: 'Start', icon: Play },
    { status: 'NO_SHOW', label: 'No show', icon: UserX },
    { status: 'CANCELLED', label: 'Cancel', icon: X },
  ],
  IN_PROGRESS: [{ status: 'COMPLETED', label: 'Complete', icon: Check }],
};

const badgeTone = (status: string): string => {
  if (status === 'COMPLETED' || status === 'CONFIRMED') return 'badge-success';
  if (status === 'CANCELLED' || status === 'NO_SHOW') return 'badge-danger';
  if (status === 'PENDING') return 'badge-warning';
  return '';
};

export default function AppointmentsPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (status !== '') params.set('status', status);
  if (date !== '') params.set('date', date);

  const appointments = useQuery({
    queryKey: ['appointments', status, date, page],
    queryFn: () => browserApi.get<Response>(`/barbers/me/appointments?${params.toString()}`),
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: string }) =>
      browserApi.patch(`/barbers/me/appointments/${id}/status`, { status: nextStatus }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  });

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Appointments</h1>
          <p>Keep every visit moving through the right stage.</p>
        </div>
        <div className="toolbar">
          <select
            aria-label="Filter by status"
            className="select"
            onChange={(event) => { setStatus(event.target.value); setPage(1); }}
            value={status}
          >
            <option value="">All statuses</option>
            {['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map(
              (value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>,
            )}
          </select>
          <input
            aria-label="Filter by date"
            className="input"
            onChange={(event) => { setDate(event.target.value); setPage(1); }}
            type="date"
            value={date}
          />
        </div>
      </div>
      {updateStatus.isError && <Notice>{errorMessage(updateStatus.error)}</Notice>}
      <section className="panel">
        {appointments.isPending ? (
          <LoadingState />
        ) : appointments.isError ? (
          <ErrorState message={errorMessage(appointments.error)} />
        ) : appointments.data.appointments.length === 0 ? (
          <EmptyState
            title="No appointments found"
            detail={status === '' && date === '' ? 'New bookings will appear here.' : 'Try clearing a filter.'}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Client</th><th>Service</th><th>Date and time</th><th>Price</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {appointments.data.appointments.map((appointment) => (
                    <tr key={appointment.id}>
                      <td>
                        <strong>{appointment.client.firstName} {appointment.client.lastName}</strong>
                        {appointment.client.phone !== null && (
                          <small style={{ display: 'block' }}>{appointment.client.phone}</small>
                        )}
                      </td>
                      <td>{appointment.service.name}</td>
                      <td>{new Date(appointment.scheduledAt).toLocaleString()}</td>
                      <td>${appointment.priceQuoted.toFixed(2)}</td>
                      <td><span className={`badge ${badgeTone(appointment.status)}`}>{appointment.status.replace('_', ' ')}</span></td>
                      <td>
                        <div className="toolbar">
                          {(transitions[appointment.status] ?? []).map((action) => {
                            const Icon = action.icon;
                            return (
                              <button
                                className="button button-secondary"
                                disabled={updateStatus.isPending}
                                key={action.status}
                                onClick={() =>
                                  updateStatus.mutate({ id: appointment.id, nextStatus: action.status })
                                }
                                type="button"
                              >
                                <Icon size={14} />
                                {action.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel-header">
              <span className="topbar-label">
                Page {appointments.data.pagination.page} of {Math.max(1, appointments.data.pagination.totalPages)}
              </span>
              <div className="toolbar">
                <button
                  className="icon-button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                  title="Previous page"
                  type="button"
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  className="icon-button"
                  disabled={page >= appointments.data.pagination.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                  title="Next page"
                  type="button"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
