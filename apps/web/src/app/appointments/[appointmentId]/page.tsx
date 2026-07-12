'use client';

import { clientApi, paymentApi } from '@barber-saas/api-client';
import { GoogleMap, LoadScript, MarkerF } from '@react-google-maps/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Car, CheckCircle2, Circle, MapPin } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { ClientHeader } from '@/components/client-header';
import { AppointmentStatusBadge, StarRating } from '@/components/client-ui';
import { Notice } from '@/components/notice';
import { browserApi } from '@/lib/browser-api';
import type { AppointmentTimeline, ClientAppointment, Review } from '@/lib/contracts';

const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

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
    refetchInterval: (query) => {
      const status = query.state.data?.currentStatus;
      return status !== undefined && ['CONFIRMED', 'ON_THE_WAY', 'ARRIVED'].includes(status)
        ? 30_000
        : false;
    },
  });
  const payment = useQuery({
    queryKey: ['appointment-payment', appointmentId],
    queryFn: () => paymentApi.appointmentStatus<PaymentStatus>(browserApi, appointmentId),
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
    new Date(data.scheduledAt).getTime() > Date.now();
  const canReview = data?.status === 'COMPLETED' && data.review === null;
  const canPay = data !== undefined && payment.data?.status === 'PENDING';
  const canRefund =
    data !== undefined && payment.data?.status === 'SUCCEEDED' && data.status !== 'COMPLETED';

  return (
    <main className="market-page narrow-page">
      <ClientHeader />
      {data === undefined ? (
        <p className="muted">Loading appointment...</p>
      ) : (
        <section className="summary-panel">
          {data.isMobileService === true && timeline.data?.currentStatus === 'ON_THE_WAY' && (
            <div className="mobile-status-banner">
              <Car size={21} />
              <div>
                <strong>Your barber is on the way</strong>
                <span>
                  {timeline.data.departedAt === null
                    ? 'Journey started'
                    : `Departed ${new Date(timeline.data.departedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                </span>
              </div>
            </div>
          )}
          {data.isMobileService === true && timeline.data?.currentStatus === 'ARRIVED' && (
            <div className="mobile-status-banner arrived">
              <MapPin size={21} />
              <div>
                <strong>Your barber has arrived</strong>
                <span>
                  {timeline.data.arrivedAt === null
                    ? 'Ready for your service'
                    : `Arrived ${new Date(timeline.data.arrivedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                </span>
              </div>
            </div>
          )}
          <div className="card-title-row">
            <h1>{data.service.name}</h1>
            <AppointmentStatusBadge status={data.status} />
          </div>
          <p>{data.barber.businessName}</p>
          <p>{new Date(data.scheduledAt).toLocaleString()}</p>
          <p>${(data.pricing?.total ?? data.priceQuoted).toFixed(2)}</p>
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
            <div className="appointment-timeline">
              <h2>Appointment status</h2>
              {timeline.data.timeline.map((item) => (
                <div
                  className={`timeline-row${item.active ? ' is-current' : ''}`}
                  key={item.status}
                >
                  {item.done ? <CheckCircle2 size={19} /> : <Circle size={19} />}
                  <div>
                    <strong>{item.label}</strong>
                    {item.at !== null && <small>{new Date(item.at).toLocaleString()}</small>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {data.isMobileService === true && serviceAddress != null && mapsKey.length > 0 && (
            <div className="appointment-map">
              <LoadScript googleMapsApiKey={mapsKey}>
                <GoogleMap
                  center={{ lat: serviceAddress.latitude, lng: serviceAddress.longitude }}
                  mapContainerClassName="appointment-map-canvas"
                  zoom={14}
                  options={{
                    fullscreenControl: false,
                    mapTypeControl: false,
                    streetViewControl: false,
                  }}
                >
                  <MarkerF
                    position={{
                      lat: serviceAddress.latitude,
                      lng: serviceAddress.longitude,
                    }}
                  />
                </GoogleMap>
              </LoadScript>
              <div className="appointment-map-label">
                <MapPin size={17} />
                <span>
                  <strong>{data.barber.businessName}</strong>
                  <small>Mobile service destination</small>
                </span>
              </div>
            </div>
          )}
          <p>
            <strong>Payment:</strong> {payment.data?.status ?? data.paymentStatus}
          </p>
          {payment.data !== undefined && (
            <p className="muted">
              Total ${payment.data.breakdown.total.toFixed(2)} · Service fee $
              {payment.data.breakdown.platformFee.toFixed(2)}
            </p>
          )}
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
          {createIntent.data !== undefined && (
            <Notice>Payment intent ready: {createIntent.data.clientSecret}</Notice>
          )}
          {createIntent.error instanceof Error && <Notice>{createIntent.error.message}</Notice>}
          {refund.error instanceof Error && <Notice>{refund.error.message}</Notice>}
          {data.clientNotes !== null && <p className="muted">Notes: {data.clientNotes}</p>}
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
