'use client';

import { clientApi, paymentApi } from '@barber-saas/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Paperclip, Repeat2 } from 'lucide-react';
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
      const scheduled = appointment.data?.scheduledAt.slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      return scheduled === today &&
        status !== undefined &&
        ['CONFIRMED', 'ON_THE_WAY', 'ARRIVED'].includes(status)
        ? 30_000
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
    mutationFn: () => paymentApi.refund(browserApi, appointmentId, 'Client requested refund'),
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

  return (
    <main className="market-page narrow-page">
      <ClientHeader />
      {data === undefined ? (
        <p className="muted">Loading appointment...</p>
      ) : (
        <section className="summary-panel">
          <div className="card-title-row">
            <h1>{data.service.name}</h1>
            <AppointmentStatusBadge status={data.status} />
          </div>
          <p>{data.barber.businessName}</p>
          <p>{new Date(data.scheduledAt).toLocaleString()}</p>
          <p>{formatPrice(data.pricing?.total ?? data.priceQuoted)}</p>
          {data.isMobileService === true && serviceAddress != null && (
            <div className="list-row">
              <div>
                <strong>Mobile service</strong>
                <small style={{ display: 'block' }}>
                  {serviceAddress.addressLine1}, {serviceAddress.city}, {serviceAddress.state}{' '}
                  {serviceAddress.zipCode}
                </small>
                <small style={{ display: 'block' }}>
                  {data.distanceMiles?.toFixed(1)} miles · about {data.estimatedTravelMinutes} min ·
                  travel ${(data.travelFee ?? 0).toFixed(2)}
                </small>
              </div>
              <a
                className="button button-secondary"
                href={`https://www.google.com/maps/dir/?api=1&destination=${serviceAddress.latitude},${serviceAddress.longitude}`}
                rel="noreferrer"
                target="_blank"
              >
                Directions
              </a>
            </div>
          )}
          {data.isMobileService === true && timeline.data !== undefined && (
            <StatusTimeline timeline={timeline.data} />
          )}
          {data.isMobileService === true && serviceAddress != null && (
            <LiveTrackingMap
              address={`${serviceAddress.addressLine1}, ${serviceAddress.city}, ${serviceAddress.state} ${serviceAddress.zipCode}`}
              appointmentId={appointmentId}
              arrivedAt={timeline.data?.arrivedAt}
              clientLatitude={serviceAddress.latitude}
              clientLongitude={serviceAddress.longitude}
              status={timeline.data?.currentStatus ?? data.status}
            />
          )}
          <p>
            <strong>Payment:</strong>{' '}
            {data.paymentMethod === 'CASH'
              ? 'Cash at appointment'
              : (payment.data?.status ?? data.paymentStatus)}
          </p>
          <div className="appointment-price-breakdown">
            <span>
              Service <strong>{formatPrice(data.pricing?.serviceFee ?? data.priceQuoted)}</strong>
            </span>
            {data.isMobileService === true && (
              <span>
                Travel <strong>{formatPrice(data.pricing?.travelFee ?? data.travelFee)}</strong>
              </span>
            )}
            <span>
              Total{' '}
              <strong>
                {formatPrice(data.pricing?.total ?? data.priceQuoted + (data.travelFee ?? 0))}
              </strong>
            </span>
          </div>
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
                <p>{data.styleReference.description ?? 'Reference attached for your barber.'}</p>
              </div>
            </div>
          )}
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
          {cancel.error instanceof Error && <Notice>{cancel.error.message}</Notice>}
        </section>
      )}
      {canReview && (
        <section className="summary-panel">
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
