'use client';

import { clientApi, paymentApi } from '@barber-saas/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  Car,
  CreditCard,
  MapPinned,
  Navigation,
  Paperclip,
  Repeat2,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { LiveTrackingMap } from '@/components/client/live-tracking-map';
import { StripePaymentPanel } from '@/components/client/stripe-payment-panel';
import { ClientHeader } from '@/components/client-header';
import { AppointmentStatusBadge, StarRating, StatusTimeline } from '@/components/client-ui';
import { Notice } from '@/components/notice';
import { browserApi } from '@/lib/browser-api';
import type { AppointmentTimeline, ClientAppointment, Review } from '@/lib/contracts';
import { formatPrice } from '@/lib/money';

type PaymentStatus = {
  status: string;
  amount: number;
  paidAt: string | null;
  breakdown: { total: number; platformFee: number; barberEarns: number };
};

type PaymentIntent = {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  breakdown: { total: number; platformFee: number; barberEarns: number };
};

type PaymentConfig = { onlinePaymentsEnabled: boolean; publishableKey: string | null };

export default function AppointmentDetailPage(): React.ReactElement {
  const params = useParams<{ appointmentId: string }>();
  const appointmentId = params.appointmentId;
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const appointment = useQuery({
    queryKey: ['client-appointment', appointmentId],
    queryFn: () => clientApi.appointment<ClientAppointment>(browserApi, appointmentId),
  });
  const timeline = useQuery({
    queryKey: ['appointment-status-updates', appointmentId],
    queryFn: () =>
      clientApi.appointmentStatusUpdates<AppointmentTimeline>(browserApi, appointmentId),
    enabled: appointment.data?.isMobileService === true,
    refetchInterval: (query) => {
      const status = query.state.data?.currentStatus;
      return status !== undefined &&
        ['CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'].includes(status)
        ? 5_000
        : false;
    },
  });
  const payment = useQuery({
    queryKey: ['appointment-payment', appointmentId],
    queryFn: () => paymentApi.appointmentStatus<PaymentStatus>(browserApi, appointmentId),
  });
  const paymentConfig = useQuery({
    queryKey: ['client-payment-config'],
    queryFn: () => paymentApi.config<PaymentConfig>(browserApi),
  });
  const cancel = useMutation({
    mutationFn: () => clientApi.cancelAppointment(browserApi, appointmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['client-appointment', appointmentId] });
    },
  });
  const review = useMutation({
    mutationFn: () =>
      clientApi.createReview<Review>(browserApi, {
        appointmentId,
        rating,
        title: title.trim() || undefined,
        comment: comment.trim() || undefined,
      }),
    onSuccess: async () => {
      setTitle('');
      setComment('');
      await queryClient.invalidateQueries({ queryKey: ['client-appointment', appointmentId] });
    },
  });
  const createIntent = useMutation({
    mutationFn: () => paymentApi.createIntent<PaymentIntent>(browserApi, appointmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['appointment-payment', appointmentId] });
    },
  });
  const refund = useMutation({
    mutationFn: () => paymentApi.refund(browserApi, appointmentId, 'Customer requested refund'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['appointment-payment', appointmentId] });
      await queryClient.invalidateQueries({ queryKey: ['client-appointment', appointmentId] });
    },
  });
  const data = appointment.data;
  const serviceAddress = data?.serviceAddress;
  const canCancel =
    data !== undefined &&
    ['PENDING', 'CONFIRMED'].includes(data.status) &&
    new Date(data.scheduledAt).getTime() > Date.now() &&
    !(data.paymentMethod === 'CARD' && payment.data?.status === 'SUCCEEDED');
  const canReview = data?.status === 'COMPLETED' && data.review === null;
  const canPay =
    data?.paymentMethod === 'CARD' &&
    payment.data?.status === 'PENDING' &&
    paymentConfig.data?.onlinePaymentsEnabled === true;
  const canRefund =
    data !== undefined && payment.data?.status === 'SUCCEEDED' && data.status !== 'COMPLETED';
  const scheduledDate =
    data === undefined
      ? null
      : new Date(data.scheduledAt).toLocaleString([], {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
  const serviceAddressLabel =
    serviceAddress == null
      ? null
      : (serviceAddress.formattedAddress ??
        `${serviceAddress.addressLine1}, ${serviceAddress.city}, ${serviceAddress.state} ${serviceAddress.zipCode}`);
  const directionsHref =
    serviceAddress == null
      ? null
      : `https://www.google.com/maps/dir/?api=1&destination=${serviceAddress.latitude},${serviceAddress.longitude}`;
  const paymentLabel =
    data?.paymentMethod === 'CASH'
      ? 'Cash at appointment'
      : (payment.data?.status ?? data?.paymentStatus ?? 'Pending');

  return (
    <main className="market-page appointment-detail-page">
      <ClientHeader />
      {data === undefined ? (
        <p className="muted">Loading appointment...</p>
      ) : (
        <section className="appointment-command-center">
          <header className="appointment-detail-header">
            <Link className="booking-back-link" href="/client/appointments">
              Back to appointments
            </Link>
            <div className="card-title-row">
              <div>
                <p className="eyebrow">Appointment details</p>
                <h1>{data.service.name}</h1>
                <p>
                  {data.barber.businessName} · {scheduledDate}
                </p>
              </div>
              <AppointmentStatusBadge status={data.status} />
            </div>
          </header>

          <div className="appointment-quick-grid">
            <div>
              <CalendarClock size={18} />
              <span>
                <small>Date and time</small>
                <strong>{scheduledDate}</strong>
              </span>
            </div>
            <div>
              {data.isMobileService === true ? <Car size={18} /> : <MapPinned size={18} />}
              <span>
                <small>Appointment type</small>
                <strong>{data.isMobileService === true ? 'Mobile visit' : 'Shop visit'}</strong>
              </span>
            </div>
            <div>
              {data.paymentMethod === 'CASH' ? <Wallet size={18} /> : <CreditCard size={18} />}
              <span>
                <small>Payment</small>
                <strong>{paymentLabel}</strong>
              </span>
            </div>
          </div>

          <div className="appointment-detail-grid">
            <div className="appointment-detail-main">
              {data.isMobileService === true && serviceAddress != null && (
                <section className="appointment-map-card">
                  <div className="appointment-section-heading">
                    <div>
                      <p className="eyebrow">Mobile service location</p>
                      <h2>Your exact arrival pin</h2>
                    </div>
                    {directionsHref !== null && (
                      <a
                        className="button button-secondary"
                        href={directionsHref}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <Navigation size={16} /> Directions
                      </a>
                    )}
                  </div>
                  <LiveTrackingMap
                    address={serviceAddressLabel ?? 'Pinned service location'}
                    appointmentId={appointmentId}
                    arrivedAt={timeline.data?.arrivedAt}
                    clientLatitude={serviceAddress.latitude}
                    clientLongitude={serviceAddress.longitude}
                    status={timeline.data?.currentStatus ?? data.status}
                  />
                  <div className="appointment-location-card">
                    <MapPinned size={18} />
                    <div>
                      <strong>
                        {serviceAddress.source === 'coordinate_fallback'
                          ? 'Pinned service location'
                          : serviceAddress.addressLine1}
                      </strong>
                      <span>
                        {serviceAddress.formattedAddress ??
                          `${serviceAddress.city}, ${serviceAddress.state} ${serviceAddress.zipCode}`}
                      </span>
                      <small>
                        {serviceAddress.isApproximateAddress === true
                          ? 'Address lookup was approximate. The exact pin is saved for navigation.'
                          : 'Exact coordinates are saved for navigation. Address text is supporting context.'}
                      </small>
                    </div>
                  </div>
                </section>
              )}

              {data.isMobileService === true && timeline.data !== undefined && (
                <section className="appointment-info-card">
                  <StatusTimeline timeline={timeline.data} />
                </section>
              )}

              <section className="appointment-info-card">
                <div className="appointment-section-heading">
                  <div>
                    <p className="eyebrow">Notes</p>
                    <h2>Details for the visit</h2>
                  </div>
                </div>
                <div className="appointment-notes-grid">
                  <div>
                    <strong>Your notes</strong>
                    <p>{data.clientNotes ?? 'No notes added.'}</p>
                  </div>
                  <div>
                    <strong>Barber's response</strong>
                    <p>{data.barberNotes ?? 'No response yet.'}</p>
                  </div>
                </div>
                {data.styleReference != null && (
                  <div className="style-reference-card">
                    <Paperclip size={18} />
                    <div>
                      <strong>{data.styleReference.styleName ?? 'Style reference'}</strong>
                      <p>
                        {data.styleReference.description ?? 'Reference attached for your barber.'}
                      </p>
                    </div>
                  </div>
                )}
                {data.styleReference == null && data.styleNotes != null && (
                  <div className="style-reference-card">
                    <Paperclip size={18} />
                    <div>
                      <strong>New style request</strong>
                      <p>{data.styleNotes}</p>
                    </div>
                  </div>
                )}
              </section>
            </div>

            <aside className="appointment-side-panel">
              <section className="appointment-info-card">
                <p className="eyebrow">Payment summary</p>
                <h2>{formatPrice(data.pricing?.total ?? data.priceQuoted)}</h2>
                <div className="appointment-price-breakdown">
                  <span>
                    Service{' '}
                    <strong>{formatPrice(data.pricing?.serviceFee ?? data.priceQuoted)}</strong>
                  </span>
                  {data.isMobileService === true && (
                    <span>
                      Travel{' '}
                      <strong>{formatPrice(data.pricing?.travelFee ?? data.travelFee)}</strong>
                    </span>
                  )}
                  <span>
                    Total{' '}
                    <strong>
                      {formatPrice(data.pricing?.total ?? data.priceQuoted + (data.travelFee ?? 0))}
                    </strong>
                  </span>
                </div>
                <p className="appointment-payment-note">
                  {data.paymentMethod === 'CASH'
                    ? 'You will pay your barber at the appointment.'
                    : 'Online payment is handled securely through Stripe.'}
                </p>
                <div className="button-row">
                  {canPay && (
                    <button
                      className="button button-primary"
                      disabled={createIntent.isPending}
                      onClick={() => createIntent.mutate()}
                      type="button"
                    >
                      {createIntent.isPending ? 'Preparing payment...' : 'Pay now'}
                    </button>
                  )}
                  {canRefund && (
                    <button
                      className="button button-danger"
                      disabled={refund.isPending}
                      onClick={() => refund.mutate()}
                      type="button"
                    >
                      {refund.isPending ? 'Refunding...' : 'Request refund'}
                    </button>
                  )}
                </div>
              </section>

              {data.isMobileService === true && serviceAddress != null && (
                <section className="appointment-info-card">
                  <p className="eyebrow">Travel</p>
                  <h2>Mobile visit</h2>
                  <div className="appointment-travel-list">
                    <span>
                      <strong>{data.distanceMiles?.toFixed(1) ?? '--'} miles</strong>
                      Distance
                    </span>
                    <span>
                      <strong>{data.estimatedTravelMinutes ?? '--'} min</strong>
                      Estimated drive
                    </span>
                    <span>
                      <strong>{formatPrice(data.travelFee ?? 0)}</strong>
                      Travel fee
                    </span>
                  </div>
                </section>
              )}

              <section className="appointment-info-card">
                <p className="eyebrow">Actions</p>
                <div className="appointment-action-stack">
                  {data.status === 'COMPLETED' && (
                    <Link
                      className="button button-secondary"
                      href={`/client/barbers/${data.barber.id}/book?serviceId=${data.service.id}`}
                    >
                      <Repeat2 size={16} /> Book again
                    </Link>
                  )}
                  {canCancel && (
                    <button
                      className="button button-danger"
                      disabled={cancel.isPending}
                      onClick={() => {
                        if (window.confirm('Cancel this appointment?')) cancel.mutate();
                      }}
                      type="button"
                    >
                      {cancel.isPending ? 'Cancelling...' : 'Cancel appointment'}
                    </button>
                  )}
                </div>
                {cancel.error instanceof Error && <Notice>{cancel.error.message}</Notice>}
              </section>
            </aside>
          </div>

          {createIntent.data !== undefined && paymentConfig.data?.publishableKey != null && (
            <StripePaymentPanel
              amount={createIntent.data.amount}
              appointmentId={appointmentId}
              clientSecret={createIntent.data.clientSecret}
              publishableKey={paymentConfig.data.publishableKey}
              onComplete={async () => {
                createIntent.reset();
                await queryClient.invalidateQueries({
                  queryKey: ['appointment-payment', appointmentId],
                });
              }}
            />
          )}
          {createIntent.error instanceof Error && <Notice>{createIntent.error.message}</Notice>}
          {refund.error instanceof Error && <Notice>{refund.error.message}</Notice>}
        </section>
      )}
      {canReview && (
        <section className="appointment-review-panel">
          <h2>Leave a review</h2>
          <StarRating value={rating} interactive onChange={setRating} />
          <input
            className="input"
            placeholder="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <textarea
            className="textarea"
            placeholder="Comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          <button
            className="button button-primary"
            disabled={review.isPending}
            onClick={() => review.mutate()}
            type="button"
          >
            {review.isPending ? 'Submitting...' : 'Submit review'}
          </button>
          {review.error instanceof Error && <Notice>{review.error.message}</Notice>}
        </section>
      )}
    </main>
  );
}
