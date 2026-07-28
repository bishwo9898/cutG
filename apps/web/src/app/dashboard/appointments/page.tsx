'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Play, UserX, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Notice } from '@/components/notice';
import { EmptyState, ErrorState, LoadingState } from '@/components/query-states';
import { browserApi } from '@/lib/browser-api';
import type { Appointment } from '@/lib/contracts';
import { errorMessage } from '@/lib/errors';

type Response = {
  appointments: Appointment[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
type LocationPingBody = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  headingDegrees?: number;
  speedMs?: number;
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
  ON_THE_WAY: [{ status: 'ARRIVED', label: 'Arrived', icon: Check }],
  ARRIVED: [{ status: 'IN_PROGRESS', label: 'Start service', icon: Play }],
  IN_PROGRESS: [{ status: 'COMPLETED', label: 'Complete', icon: Check }],
};

const badgeTone = (status: string): string => {
  if (status === 'COMPLETED' || status === 'CONFIRMED') return 'badge-success';
  if (status === 'CANCELLED' || status === 'NO_SHOW') return 'badge-danger';
  if (status === 'PENDING') return 'badge-warning';
  return '';
};

const trackingActiveStatuses = ['ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'];
const trackingStopStatuses = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

const distanceMeters = (
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number },
): number => {
  const radius = 6_371_000;
  const leftLat = (left.latitude * Math.PI) / 180;
  const rightLat = (right.latitude * Math.PI) / 180;
  const deltaLat = ((right.latitude - left.latitude) * Math.PI) / 180;
  const deltaLon = ((right.longitude - left.longitude) * Math.PI) / 180;
  const value =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(deltaLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

export default function AppointmentsPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [startingTrackingId, setStartingTrackingId] = useState<string | null>(null);
  const [trackingState, setTrackingState] = useState<{
    appointmentId: string;
    lastPingAt: string | null;
    warning: string | null;
  } | null>(null);
  const watchId = useRef<number | null>(null);
  const activeTrackingId = useRef<string | null>(null);
  const lastPing = useRef<{ at: number; latitude: number; longitude: number } | null>(null);
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

  const stopTracking = useCallback((appointmentId?: string): void => {
    if (
      appointmentId !== undefined &&
      activeTrackingId.current !== null &&
      activeTrackingId.current !== appointmentId
    ) {
      return;
    }
    if (watchId.current !== null) {
      window.navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    activeTrackingId.current = null;
    lastPing.current = null;
    setTrackingState(null);
  }, []);

  const sendLocationPing = useCallback(
    async (appointmentId: string, coordinates: GeolocationCoordinates): Promise<void> => {
      const body: LocationPingBody = {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        accuracyMeters: coordinates.accuracy,
        ...(coordinates.heading === null ? {} : { headingDegrees: coordinates.heading }),
        ...(coordinates.speed === null ? {} : { speedMs: coordinates.speed }),
      };
      await browserApi.post(`/barbers/me/appointments/${appointmentId}/location`, body);
      const pingAt = new Date().toISOString();
      lastPing.current = {
        at: Date.now(),
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      };
      setTrackingState({ appointmentId, lastPingAt: pingAt, warning: null });
    },
    [],
  );

  const startTracking = useCallback(
    (appointment: Appointment, coordinates: GeolocationCoordinates): void => {
      if (!('geolocation' in window.navigator)) {
        setTrackingState({
          appointmentId: appointment.id,
          lastPingAt: null,
          warning: 'Live location unavailable. Your browser does not support location sharing.',
        });
        return;
      }
      stopTracking();
      activeTrackingId.current = appointment.id;
      void sendLocationPing(appointment.id, coordinates).catch(() => {
        setTrackingState({
          appointmentId: appointment.id,
          lastPingAt: null,
          warning: 'Live location could not be sent. Check browser location permission.',
        });
      });
      watchId.current = window.navigator.geolocation.watchPosition(
        (position) => {
          const previous = lastPing.current;
          const next = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          const shouldSend =
            previous === null ||
            Date.now() - previous.at >= 5_000 ||
            distanceMeters(previous, next) >= 20;
          if (!shouldSend) return;
          void sendLocationPing(appointment.id, position.coords).catch(() => {
            setTrackingState((current) =>
              current?.appointmentId === appointment.id
                ? {
                    ...current,
                    warning: 'Live location could not be sent. Retrying with the next update.',
                  }
                : current,
            );
          });
        },
        () => {
          setTrackingState((current) =>
            current?.appointmentId === appointment.id
              ? {
                  ...current,
                  warning: 'Live location unavailable. Check browser location permission.',
                }
              : current,
          );
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
      );
    },
    [sendLocationPing, stopTracking],
  );

  useEffect((): (() => void) => {
    return () => stopTracking();
  }, [stopTracking]);

  const handleStatusAction = (appointment: Appointment, nextStatus: string): void => {
    if (nextStatus === 'ON_THE_WAY' && appointment.isMobileService === true) {
      if (!('geolocation' in window.navigator)) {
        setTrackingState({
          appointmentId: appointment.id,
          lastPingAt: null,
          warning:
            'Journey not started. This browser does not support the live location required for the test.',
        });
        return;
      }
      setStartingTrackingId(appointment.id);
      window.navigator.geolocation.getCurrentPosition(
        (position) => {
          updateStatus.mutate(
            { id: appointment.id, nextStatus },
            {
              onSettled: () => setStartingTrackingId(null),
              onSuccess: () => startTracking(appointment, position.coords),
            },
          );
        },
        () => {
          setTrackingState({
            appointmentId: appointment.id,
            lastPingAt: null,
            warning:
              'Journey not started. Allow precise location in your browser, then press Start journey again.',
          });
          setStartingTrackingId(null);
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
      );
      return;
    }
    updateStatus.mutate(
      { id: appointment.id, nextStatus },
      {
        onSuccess: () => {
          if (trackingStopStatuses.includes(nextStatus)) stopTracking(appointment.id);
        },
      },
    );
  };

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
                {value.replace('_', ' ')}
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
      {trackingState?.warning !== null && trackingState?.warning !== undefined && (
        <Notice tone="warning">{trackingState.warning}</Notice>
      )}
      {trackingState?.warning === null && trackingState.lastPingAt !== null && (
        <Notice tone="success">
          Live location sharing is active. Last update{' '}
          {new Date(trackingState.lastPingAt).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
          })}
          .
        </Notice>
      )}
      <section className="panel">
        {appointments.isPending ? (
          <LoadingState />
        ) : appointments.isError ? (
          <ErrorState message={errorMessage(appointments.error)} />
        ) : appointments.data.appointments.length === 0 ? (
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
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Service</th>
                    <th>Date and time</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.data.appointments.map((appointment) => (
                    <tr key={appointment.id}>
                      <td>
                        <strong>
                          {appointment.client.firstName} {appointment.client.lastName}
                        </strong>
                        {appointment.client.phone !== null && (
                          <small style={{ display: 'block' }}>{appointment.client.phone}</small>
                        )}
                      </td>
                      <td>
                        {appointment.service.name}
                        {appointment.clientNotes !== null && (
                          <small style={{ display: 'block' }}>
                            Client: {appointment.clientNotes}
                          </small>
                        )}
                        {appointment.barberNotes !== null && (
                          <small style={{ display: 'block' }}>
                            My note: {appointment.barberNotes}
                          </small>
                        )}
                        {appointment.styleReference != null && (
                          <div className="appointment-style-inline">
                            <strong>
                              {appointment.styleReference.styleName ?? 'Style reference'}
                            </strong>
                            <span>{appointment.styleReference.description}</span>
                            {(appointment.styleReference.previewImageUrl ??
                              appointment.styleReference.sourcePhotoUrl) !== null && (
                              <a
                                href={
                                  appointment.styleReference.previewImageUrl ??
                                  appointment.styleReference.sourcePhotoUrl ??
                                  undefined
                                }
                                rel="noreferrer"
                                target="_blank"
                              >
                                View selected look
                              </a>
                            )}
                          </div>
                        )}
                        {appointment.styleReference == null && appointment.styleNotes != null && (
                          <div className="appointment-style-inline">
                            <strong>New style request</strong>
                            <span>{appointment.styleNotes}</span>
                          </div>
                        )}
                        {appointment.isMobileService === true && (
                          <small style={{ display: 'block' }}>
                            Mobile · {appointment.serviceAddress?.addressLine1},{' '}
                            {appointment.serviceAddress?.city}
                          </small>
                        )}
                      </td>
                      <td>{new Date(appointment.scheduledAt).toLocaleString()}</td>
                      <td>
                        ${(appointment.priceQuoted + (appointment.travelFee ?? 0)).toFixed(2)}
                      </td>
                      <td>
                        <span className={`badge ${badgeTone(appointment.status)}`}>
                          {appointment.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <div className="toolbar">
                          {(appointment.status === 'CONFIRMED' &&
                          appointment.isMobileService === true
                            ? [
                                { status: 'ON_THE_WAY', label: 'Start journey', icon: Play },
                                ...(transitions.CONFIRMED ?? []).slice(1),
                              ]
                            : (transitions[appointment.status] ?? [])
                          ).map((action) => {
                            const Icon = action.icon;
                            return (
                              <button
                                className="button button-secondary"
                                disabled={
                                  updateStatus.isPending || startingTrackingId === appointment.id
                                }
                                key={action.status}
                                onClick={() => handleStatusAction(appointment, action.status)}
                                type="button"
                              >
                                <Icon size={14} />
                                {startingTrackingId === appointment.id &&
                                action.status === 'ON_THE_WAY'
                                  ? 'Starting GPS...'
                                  : action.label}
                              </button>
                            );
                          })}
                          {appointment.isMobileService === true &&
                            trackingActiveStatuses.includes(appointment.status) &&
                            activeTrackingId.current !== appointment.id && (
                              <button
                                className="button button-secondary"
                                disabled={startingTrackingId === appointment.id}
                                onClick={() => {
                                  if (!('geolocation' in window.navigator)) {
                                    setTrackingState({
                                      appointmentId: appointment.id,
                                      lastPingAt: null,
                                      warning:
                                        'Live location unavailable. Your browser does not support location sharing.',
                                    });
                                    return;
                                  }
                                  setStartingTrackingId(appointment.id);
                                  window.navigator.geolocation.getCurrentPosition(
                                    (position) => {
                                      setStartingTrackingId(null);
                                      startTracking(appointment, position.coords);
                                    },
                                    () => {
                                      setStartingTrackingId(null);
                                      setTrackingState({
                                        appointmentId: appointment.id,
                                        lastPingAt: null,
                                        warning:
                                          'Live location unavailable. Check browser location permission.',
                                      });
                                    },
                                    {
                                      enableHighAccuracy: true,
                                      maximumAge: 5_000,
                                      timeout: 15_000,
                                    },
                                  );
                                }}
                                type="button"
                              >
                                <Play size={14} />
                                Share location
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel-header">
              <span className="topbar-label">
                Page {appointments.data.pagination.page} of{' '}
                {Math.max(1, appointments.data.pagination.totalPages)}
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
