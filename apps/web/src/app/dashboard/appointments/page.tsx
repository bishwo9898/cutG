'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  MapPin,
  Play,
  Scissors,
  UserX,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Notice } from '@/components/notice';
import { EmptyState, ErrorState, LoadingState } from '@/components/query-states';
import { useBarberJourney } from '@/hooks/use-barber-journey';
import { appointmentStatusClass } from '@/lib/appointment-ui';
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
    { status: 'IN_PROGRESS', label: 'Begin service', icon: Play },
    { status: 'NO_SHOW', label: 'No show', icon: UserX },
    { status: 'CANCELLED', label: 'Cancel', icon: X },
  ],
  ON_THE_WAY: [{ status: 'ARRIVED', label: "I've arrived", icon: MapPin }],
  ARRIVED: [{ status: 'IN_PROGRESS', label: 'Begin service', icon: Scissors }],
  IN_PROGRESS: [{ status: 'COMPLETED', label: 'Complete', icon: Check }],
};

const stopStatuses = ['ARRIVED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

const actionList = (
  appointment: Appointment,
): Array<{ status: string; label: string; icon: typeof Check }> =>
  appointment.status === 'CONFIRMED' && appointment.isMobileService === true
    ? [
        { status: 'ON_THE_WAY', label: 'Start journey', icon: Play },
        ...(transitions.CONFIRMED ?? []).slice(1),
      ]
    : (transitions[appointment.status] ?? []);

const totalPrice = (appointment: Appointment): number =>
  appointment.priceQuoted + (appointment.travelFee ?? 0);

export default function AppointmentsPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const { resumeTracking, startJourney, startingId, stopTracking, trackingState } =
    useBarberJourney();
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
    onSuccess: async (_data, variables) => {
      if (stopStatuses.includes(variables.nextStatus)) stopTracking(variables.id);
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const handleStatusAction = (appointment: Appointment, nextStatus: string): void => {
    if (nextStatus === 'ON_THE_WAY') {
      void startJourney(appointment.id);
      return;
    }
    updateStatus.mutate({ id: appointment.id, nextStatus });
  };

  const renderActions = (appointment: Appointment): React.ReactElement => (
    <div className="appointment-actions">
      <Link
        aria-label={`Review booking for ${appointment.client.firstName} ${appointment.client.lastName}`}
        className="button button-secondary appointment-review-link"
        href={`/barber/dashboard/appointments/${appointment.id}`}
      >
        <Eye size={15} /> Review booking
      </Link>
      {actionList(appointment).map((action) => {
        const Icon = action.icon;
        return (
          <button
            className="button button-secondary"
            disabled={updateStatus.isPending || startingId === appointment.id}
            key={action.status}
            onClick={() => handleStatusAction(appointment, action.status)}
            type="button"
          >
            <Icon size={14} />
            {startingId === appointment.id && action.status === 'ON_THE_WAY'
              ? 'Starting GPS…'
              : action.label}
          </button>
        );
      })}
      {appointment.isMobileService === true &&
        appointment.status === 'ON_THE_WAY' &&
        trackingState?.appointmentId !== appointment.id && (
          <button
            className="button button-secondary"
            disabled={startingId === appointment.id}
            onClick={() => void resumeTracking(appointment.id)}
            type="button"
          >
            <MapPin size={14} /> Resume sharing
          </button>
        )}
    </div>
  );

  const list = appointments.data?.appointments ?? [];
  return (
    <main className="page barber-appointments-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Schedule</p>
          <h1>Appointments</h1>
          <p>Review each booking clearly and move it through the right stage.</p>
        </div>
        <div className="toolbar appointment-filters">
          <select
            aria-label="Filter by status"
            className="select"
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            value={status}
          >
            <option value="">All statuses</option>
            {[
              'PENDING',
              'CONFIRMED',
              'ON_THE_WAY',
              'ARRIVED',
              'IN_PROGRESS',
              'COMPLETED',
              'CANCELLED',
              'NO_SHOW',
            ].map((value) => (
              <option key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
          <input
            aria-label="Filter by date"
            className="input"
            onChange={(event) => {
              setDate(event.target.value);
              setPage(1);
            }}
            type="date"
            value={date}
          />
        </div>
      </div>

      {updateStatus.isError && <Notice>{errorMessage(updateStatus.error)}</Notice>}
      {trackingState?.warning != null && <Notice tone="warning">{trackingState.warning}</Notice>}
      {trackingState?.warning === null && trackingState.lastPingAt !== null && (
        <Notice tone="success">
          Foreground location sharing is active. Keep this browser tab open while traveling. Last
          update{' '}
          {new Date(trackingState.lastPingAt).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
          })}
          . Use the cutG mobile app for background sharing.
        </Notice>
      )}

      <section className="panel appointments-panel">
        {appointments.isPending ? (
          <LoadingState />
        ) : appointments.isError ? (
          <ErrorState message={errorMessage(appointments.error)} />
        ) : list.length === 0 ? (
          <EmptyState
            title="No appointments found"
            detail={
              status === '' && date === ''
                ? 'New bookings will appear here.'
                : 'Try clearing a filter.'
            }
          />
        ) : (
          <>
            <div className="table-wrap appointments-table-wrap">
              <table className="table appointments-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Service</th>
                    <th>Schedule</th>
                    <th>Type</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((appointment) => (
                    <tr className="appointment-row" key={appointment.id}>
                      <td>
                        <strong>
                          {appointment.client.firstName} {appointment.client.lastName}
                        </strong>
                        {appointment.client.phone !== null && (
                          <small>{appointment.client.phone}</small>
                        )}
                      </td>
                      <td>
                        <strong>{appointment.service.name}</strong>
                        <small>{appointment.durationMinutes} minutes</small>
                      </td>
                      <td>
                        {new Date(appointment.scheduledAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        <small>
                          {new Date(appointment.scheduledAt).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </small>
                      </td>
                      <td>
                        <span className="appointment-type-label">
                          {appointment.isMobileService === true ? (
                            <MapPin size={14} />
                          ) : (
                            <Scissors size={14} />
                          )}
                          {appointment.isMobileService === true ? 'Mobile' : 'Shop'}
                        </span>
                      </td>
                      <td>
                        <strong>${totalPrice(appointment).toFixed(2)}</strong>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${appointmentStatusClass(appointment.status)}`}
                        >
                          {appointment.status.replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td>{renderActions(appointment)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="appointment-card-list">
              {list.map((appointment) => (
                <article className="appointment-list-card" key={appointment.id}>
                  <header>
                    <div>
                      <strong>
                        {appointment.client.firstName} {appointment.client.lastName}
                      </strong>
                      <span>{appointment.service.name}</span>
                    </div>
                    <span className={`status-badge ${appointmentStatusClass(appointment.status)}`}>
                      {appointment.status.replaceAll('_', ' ')}
                    </span>
                  </header>
                  <div className="appointment-card-facts">
                    <span>
                      <CalendarDays size={15} />
                      {new Date(appointment.scheduledAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                    <span>
                      {appointment.isMobileService === true ? (
                        <MapPin size={15} />
                      ) : (
                        <Scissors size={15} />
                      )}
                      {appointment.isMobileService === true
                        ? 'Mobile appointment'
                        : 'Shop appointment'}
                    </span>
                    <strong>${totalPrice(appointment).toFixed(2)}</strong>
                  </div>
                  {renderActions(appointment)}
                </article>
              ))}
            </div>

            <div className="panel-header appointment-pagination">
              <span className="topbar-label">
                Page {appointments.data?.pagination.page} of{' '}
                {Math.max(1, appointments.data?.pagination.totalPages ?? 1)}
              </span>
              <div className="toolbar">
                <button
                  aria-label="Previous page"
                  className="icon-button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                  type="button"
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  aria-label="Next page"
                  className="icon-button"
                  disabled={page >= (appointments.data?.pagination.totalPages ?? 1)}
                  onClick={() => setPage((current) => current + 1)}
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
