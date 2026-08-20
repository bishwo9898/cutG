'use client';

import type { BarberAppointmentDetail } from '@barber-saas/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  CreditCard,
  ExternalLink,
  MapPin,
  Navigation,
  Phone,
  Play,
  Scissors,
  UserX,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { ClientMap } from '@/components/client/client-map';
import { Notice } from '@/components/notice';
import { ErrorState, LoadingState } from '@/components/query-states';
import { useBarberJourney } from '@/hooks/use-barber-journey';
import { appointmentStatusClass } from '@/lib/appointment-ui';
import { browserApi } from '@/lib/browser-api';
import type { DrivingRoute } from '@/lib/driving-route';
import { errorMessage } from '@/lib/errors';

const transitions: Record<string, Array<{ status: string; label: string; icon: typeof Check }>> = {
  PENDING: [
    { status: 'CONFIRMED', label: 'Confirm booking', icon: Check },
    { status: 'CANCELLED', label: 'Cancel booking', icon: X },
  ],
  CONFIRMED: [
    { status: 'IN_PROGRESS', label: 'Begin service', icon: Play },
    { status: 'NO_SHOW', label: 'Mark no-show', icon: UserX },
    { status: 'CANCELLED', label: 'Cancel booking', icon: X },
  ],
  ON_THE_WAY: [{ status: 'ARRIVED', label: "I've arrived", icon: MapPin }],
  ARRIVED: [{ status: 'IN_PROGRESS', label: 'Begin service', icon: Scissors }],
  IN_PROGRESS: [{ status: 'COMPLETED', label: 'Complete appointment', icon: Check }],
};

const statusOrder = ['PENDING', 'CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'];

const addressLabel = (appointment: BarberAppointmentDetail): string => {
  const location = appointment.location;
  if (location === null) return 'No location saved';
  return (
    location.formattedAddress ??
    [location.addressLine1, location.city, location.state, location.zipCode]
      .filter((part): part is string => part !== null && part.length > 0)
      .join(', ')
  );
};

export default function AppointmentReviewPage(): React.ReactElement {
  const params = useParams<{ appointmentId: string }>();
  const appointmentId = params.appointmentId;
  const queryClient = useQueryClient();
  const [drivingRoute, setDrivingRoute] = useState<DrivingRoute | null>(null);
  const { resumeTracking, startJourney, startingId, stopTracking, trackingState } =
    useBarberJourney();
  const appointment = useQuery({
    queryKey: ['appointments', 'detail', appointmentId],
    queryFn: () =>
      browserApi.get<BarberAppointmentDetail>(`/barbers/me/appointments/${appointmentId}`),
  });
  const updateStatus = useMutation({
    mutationFn: (nextStatus: string) =>
      browserApi.patch(`/barbers/me/appointments/${appointmentId}/status`, {
        status: nextStatus,
      }),
    onSuccess: async (_data, nextStatus) => {
      if (['ARRIVED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(nextStatus)) {
        stopTracking(appointmentId);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['appointments', 'detail', appointmentId] }),
      ]);
    },
  });

  if (appointment.isPending)
    return (
      <main className="page">
        <LoadingState />
      </main>
    );
  if (appointment.isError || appointment.data === undefined) {
    return (
      <main className="page">
        <ErrorState message={errorMessage(appointment.error)} />
      </main>
    );
  }

  const item = appointment.data;
  const actions =
    item.status === 'CONFIRMED' && item.isMobileService
      ? [
          { status: 'ON_THE_WAY', label: 'Start journey', icon: Navigation },
          ...(transitions.CONFIRMED ?? []).slice(1),
        ]
      : (transitions[item.status] ?? []);
  const location = item.location;
  const coordinates =
    location?.latitude != null && location.longitude != null
      ? { latitude: location.latitude, longitude: location.longitude }
      : null;
  const currentIndex = statusOrder.indexOf(item.status);
  const routeOrigin =
    trackingState?.appointmentId === item.id && trackingState.position !== null
      ? trackingState.position
      : (item.journey.routeOrigin ?? null);
  const directionUrl =
    coordinates !== null
      ? `https://www.google.com/maps/dir/?api=1${
          routeOrigin === null ? '' : `&origin=${routeOrigin.latitude},${routeOrigin.longitude}`
        }&destination=${coordinates.latitude},${coordinates.longitude}&travelmode=driving&dir_action=navigate`
      : null;
  const selectedStyleImage =
    item.styleReference?.previewImageUrl ?? item.styleReference?.sourcePhotoUrl ?? null;
  const startJourneyAndNavigate = async (): Promise<void> => {
    const navigationTab = directionUrl === null ? null : window.open('about:blank', '_blank');
    if (navigationTab !== null) navigationTab.opener = null;
    const startPosition = await startJourney(item.id);
    if (startPosition === null) {
      navigationTab?.close();
      return;
    }
    if (coordinates !== null) {
      const preciseNavigationUrl = `https://www.google.com/maps/dir/?api=1&origin=${startPosition.latitude},${startPosition.longitude}&destination=${coordinates.latitude},${coordinates.longitude}&travelmode=driving&dir_action=navigate`;
      if (navigationTab !== null) navigationTab.location.assign(preciseNavigationUrl);
      else window.open(preciseNavigationUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <main className="page appointment-review-page">
      <Link className="appointment-review-back" href="/barber/dashboard/appointments">
        <ArrowLeft size={16} /> Back to appointments
      </Link>
      <header className="appointment-review-header">
        <div>
          <p className="eyebrow">Review booking</p>
          <h1>
            {item.client.firstName} {item.client.lastName}
          </h1>
          <p>Everything you need before the appointment, in one place.</p>
        </div>
        <span
          className={`status-badge appointment-review-status ${appointmentStatusClass(item.status)}`}
        >
          {item.status.replaceAll('_', ' ')}
        </span>
      </header>

      {updateStatus.isError && <Notice>{errorMessage(updateStatus.error)}</Notice>}
      {trackingState?.warning != null && <Notice tone="warning">{trackingState.warning}</Notice>}
      {trackingState?.warning === null && trackingState.lastPingAt !== null && (
        <Notice tone="success">
          Foreground location sharing is active. Keep this tab open, or use the mobile app for
          background tracking.
        </Notice>
      )}

      <section className="appointment-review-grid">
        <div className="appointment-review-main">
          <article className="panel appointment-detail-card appointment-overview-card">
            <div className="appointment-detail-heading">
              <div>
                <span className="appointment-detail-icon">
                  <Scissors size={18} />
                </span>
                <div>
                  <small>Service</small>
                  <h2>{item.service.name}</h2>
                </div>
              </div>
              <strong>${item.pricing.total.toFixed(2)}</strong>
            </div>
            <div className="appointment-detail-facts">
              <span>
                <CalendarDays size={16} />
                {new Date(item.scheduledAt).toLocaleDateString([], {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <span>
                <Clock3 size={16} />
                {new Date(item.scheduledAt).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}{' '}
                · {item.durationMinutes} minutes
              </span>
              <span>
                <MapPin size={16} />
                {item.isMobileService ? 'Mobile appointment' : 'Shop appointment'}
              </span>
              <span>
                <CreditCard size={16} />
                {item.paymentMethod} · {item.paymentStatus.replaceAll('_', ' ')}
              </span>
            </div>
          </article>

          <article className="panel appointment-detail-card">
            <div className="appointment-detail-section-title">
              <div>
                <MapPin size={18} />
                <h2>Appointment location</h2>
              </div>
              {directionUrl !== null && (
                <a
                  className="button button-secondary"
                  href={directionUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Start in Google Maps <ExternalLink size={14} />
                </a>
              )}
            </div>
            <p className="appointment-location-address">{addressLabel(item)}</p>
            {item.isMobileService &&
              (item.distanceMiles != null || item.estimatedTravelMinutes != null) && (
                <div className="appointment-travel-facts">
                  {item.distanceMiles != null && (
                    <span>{item.distanceMiles.toFixed(1)} miles away</span>
                  )}
                  {item.estimatedTravelMinutes != null && (
                    <span>About {item.estimatedTravelMinutes} minutes travel</span>
                  )}
                  <span>${item.pricing.travelFee.toFixed(2)} travel fee</span>
                </div>
              )}
            {coordinates !== null ? (
              <div className="appointment-review-map">
                <ClientMap
                  center={coordinates}
                  destination={coordinates}
                  interactive
                  onRouteChange={setDrivingRoute}
                  origin={item.isMobileService ? routeOrigin : null}
                  zoom={14}
                />
              </div>
            ) : (
              <Notice tone="warning">Map coordinates are not available for this booking.</Notice>
            )}
            {coordinates !== null && item.isMobileService && (
              <p className="muted">
                {routeOrigin === null
                  ? 'Save your shop or mobile-service origin to preview the driving route. Google Maps will use your current position when the journey starts.'
                  : drivingRoute === null
                    ? 'Showing the best available path from your saved origin. Google Maps will recalculate from your precise position when you start.'
                    : `${(drivingRoute.distanceMeters / 1609.344).toFixed(1)} miles · about ${Math.max(
                        1,
                        Math.round(drivingRoute.durationSeconds / 60),
                      )} minutes on the shortest available route.`}
              </p>
            )}
          </article>

          <article className="panel appointment-detail-card">
            <div className="appointment-detail-section-title">
              <div>
                <Scissors size={18} />
                <h2>Style and notes</h2>
              </div>
            </div>
            <div className="appointment-notes-review-grid">
              <div>
                <small>Customer note</small>
                <p>{item.clientNotes ?? 'No customer note was added.'}</p>
              </div>
              <div>
                <small>Your note</small>
                <p>{item.barberNotes ?? 'No barber note has been saved.'}</p>
              </div>
            </div>
            {item.styleReference !== null ? (
              <div className="appointment-style-review">
                {selectedStyleImage !== null && (
                  <img
                    alt={item.styleReference.styleName ?? 'Requested hairstyle'}
                    src={selectedStyleImage}
                  />
                )}
                <div>
                  <small>Requested style</small>
                  <h3>{item.styleReference.styleName ?? 'Saved style reference'}</h3>
                  <p>{item.styleReference.description ?? 'No additional style description.'}</p>
                </div>
              </div>
            ) : item.styleNotes !== null ? (
              <div className="appointment-style-review is-text-only">
                <div>
                  <small>Requested style</small>
                  <p>{item.styleNotes}</p>
                </div>
              </div>
            ) : null}
          </article>
        </div>

        <aside className="appointment-review-aside">
          <article className="panel appointment-detail-card appointment-client-card">
            <small>Customer</small>
            <h2>
              {item.client.firstName} {item.client.lastName}
            </h2>
            {item.client.phone !== null ? (
              <a className="text-link" href={`tel:${item.client.phone}`}>
                <Phone size={15} />
                {item.client.phone}
              </a>
            ) : (
              <p className="muted">No phone number on file.</p>
            )}
          </article>

          <article className="panel appointment-detail-card">
            <h2>Price breakdown</h2>
            <dl className="appointment-price-list">
              <div>
                <dt>Service</dt>
                <dd>${item.pricing.serviceFee.toFixed(2)}</dd>
              </div>
              <div>
                <dt>Travel</dt>
                <dd>${item.pricing.travelFee.toFixed(2)}</dd>
              </div>
              <div className="is-total">
                <dt>Total</dt>
                <dd>${item.pricing.total.toFixed(2)}</dd>
              </div>
            </dl>
          </article>

          <article className="panel appointment-detail-card">
            <h2>Appointment progress</h2>
            <ol className="barber-appointment-timeline">
              {(item.isMobileService
                ? statusOrder
                : statusOrder.filter((status) => !['ON_THE_WAY', 'ARRIVED'].includes(status))
              ).map((status) => {
                const stepIndex = statusOrder.indexOf(status);
                const complete = currentIndex > stepIndex || item.status === 'COMPLETED';
                const current = item.status === status;
                return (
                  <li
                    className={`${complete ? 'is-complete' : ''}${current ? ' is-current' : ''}`}
                    key={status}
                  >
                    <span>{complete ? <Check size={13} /> : null}</span>
                    <div>
                      <strong>{status.replaceAll('_', ' ')}</strong>
                      {current && <small>Current stage</small>}
                    </div>
                  </li>
                );
              })}
              {['CANCELLED', 'NO_SHOW'].includes(item.status) && (
                <li className="is-terminal">
                  <span>
                    <X size={13} />
                  </span>
                  <div>
                    <strong>{item.status.replaceAll('_', ' ')}</strong>
                    <small>Appointment closed</small>
                  </div>
                </li>
              )}
            </ol>
          </article>

          {actions.length > 0 && (
            <article className="panel appointment-detail-card appointment-next-actions">
              <h2>Next action</h2>
              {actions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <button
                    className={`button ${index === 0 ? 'button-primary' : 'button-secondary'}`}
                    disabled={updateStatus.isPending || startingId === item.id}
                    key={action.status}
                    onClick={() => {
                      if (action.status === 'ON_THE_WAY') void startJourneyAndNavigate();
                      else updateStatus.mutate(action.status);
                    }}
                    type="button"
                  >
                    <Icon size={15} />
                    {startingId === item.id && action.status === 'ON_THE_WAY'
                      ? 'Starting GPS…'
                      : action.label}
                  </button>
                );
              })}
              {item.status === 'ON_THE_WAY' && trackingState?.appointmentId !== item.id && (
                <button
                  className="button button-secondary"
                  onClick={() => void resumeTracking(item.id)}
                  type="button"
                >
                  <MapPin size={15} /> Resume foreground sharing
                </button>
              )}
            </article>
          )}
        </aside>
      </section>
    </main>
  );
}
