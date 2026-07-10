'use client';

import { clientApi } from '@barber-saas/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { AppointmentStatusBadge, StarRating } from '@/components/client-ui';
import { Notice } from '@/components/notice';
import { browserApi } from '@/lib/browser-api';
import type { ClientAppointment, Review } from '@/lib/contracts';

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
  const data = appointment.data;
  const canCancel =
    data !== undefined &&
    ['PENDING', 'CONFIRMED'].includes(data.status) &&
    new Date(data.scheduledAt).getTime() > Date.now();
  const canReview = data?.status === 'COMPLETED' && data.review === null;

  return (
    <main className="market-page narrow-page">
      <header className="market-nav">
        <Link className="brand-lockup dark" href="/">
          <span className="brand-mark">cG</span>
          cutG
        </Link>
        <nav>
          <Link href="/appointments">Appointments</Link>
        </nav>
      </header>
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
          <p>${data.priceQuoted.toFixed(2)} - Pay at the shop</p>
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
