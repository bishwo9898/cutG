'use client';

import { Calendar, Heart, Scissors, Star } from 'lucide-react';
import Link from 'next/link';

import type { ClientAppointment, PublicBarber, PublicSlot, Review } from '@/lib/contracts';

export function StarRating({
  interactive = false,
  max = 5,
  onChange,
  value,
}: {
  value: number;
  max?: number;
  interactive?: boolean;
  onChange?: (value: number) => void;
}): React.ReactElement {
  return (
    <span className="stars" aria-label={`${value} out of ${max} stars`}>
      {Array.from({ length: max }, (_, index) => {
        const starValue = index + 1;
        const filled = starValue <= value;
        if (interactive) {
          return (
            <button
              aria-label={`${starValue} stars`}
              className="star-button"
              key={starValue}
              onClick={() => onChange?.(starValue)}
              type="button"
            >
              <Star fill={filled ? 'currentColor' : 'none'} size={18} />
            </button>
          );
        }
        return <Star fill={filled ? 'currentColor' : 'none'} key={starValue} size={16} />;
      })}
    </span>
  );
}

export function BarberCard({
  barber,
  showSave = false,
}: {
  barber: PublicBarber;
  showSave?: boolean;
}): React.ReactElement {
  return (
    <article className="market-card">
      <Link href={`/client/barbers/${barber.id}`}>
        <div
          className="barber-photo"
          style={{
            backgroundImage:
              barber.profilePhotoUrl === null ? undefined : `url(${barber.profilePhotoUrl})`,
          }}
        >
          {barber.profilePhotoUrl === null && <Scissors size={30} />}
        </div>
        <div className="card-body">
          <div className="card-title-row">
            <h3>{barber.businessName}</h3>
            <span className="card-title-actions">
              {barber.mobileService?.isEnabled === true && (
                <span className="mobile-badge">Mobile</span>
              )}
              {showSave && <Heart size={18} />}
            </span>
          </div>
          <p className="muted">
            {[barber.city, barber.state].filter(Boolean).join(', ') || 'Location coming soon'}
          </p>
          <div className="rating-row">
            <StarRating value={Math.round(barber.averageRating)} />
            <span>{barber.averageRating.toFixed(1)}</span>
            <span className="muted">({barber.totalReviews})</span>
          </div>
          <p className="card-meta">
            {barber.lowestServicePrice === null
              ? 'Services being added'
              : `From $${barber.lowestServicePrice.toFixed(2)}`}
          </p>
          <p className="muted small">
            {barber.nextAvailableSlot === null
              ? 'No open slots listed'
              : `Next: ${new Date(barber.nextAvailableSlot).toLocaleString()}`}
          </p>
        </div>
      </Link>
    </article>
  );
}

export function SlotPicker({
  onSelect,
  selectedId,
  slots,
}: {
  slots: PublicSlot[];
  selectedId?: string | undefined;
  onSelect: (slot: PublicSlot) => void;
}): React.ReactElement {
  const available = slots.filter((slot) => slot.isAvailable);
  if (available.length === 0) return <p className="muted">No available slots for this range.</p>;
  return (
    <div className="slot-grid">
      {available.map((slot) => (
        <button
          className={`slot-button${selectedId === slot.id ? ' is-selected' : ''}`}
          key={slot.id}
          onClick={() => onSelect(slot)}
          type="button"
        >
          <Calendar size={15} />
          <span>{new Date(`${slot.date}T00:00:00`).toLocaleDateString()}</span>
          <strong>{slot.startTime}</strong>
        </button>
      ))}
    </div>
  );
}

export function AppointmentStatusBadge({ status }: { status: string }): React.ReactElement {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{status}</span>;
}

export function ReviewCard({ review }: { review: Review }): React.ReactElement {
  return (
    <article className="review-card">
      <StarRating value={review.rating} />
      {review.title !== null && <h3>{review.title}</h3>}
      {review.comment !== null && <p>{review.comment}</p>}
      {review.client !== undefined && (
        <p className="muted small">
          {review.client.firstName} {review.client.lastInitial}.
        </p>
      )}
    </article>
  );
}

export function BookingSteps({
  currentStep,
  labels = ['Service', 'Time', 'Confirm'],
}: {
  currentStep: number;
  labels?: string[];
}): React.ReactElement {
  return (
    <div className="steps">
      {labels.map((label, index) => (
        <span className={currentStep === index + 1 ? 'is-active' : ''} key={label}>
          {label}
        </span>
      ))}
    </div>
  );
}

export function AppointmentCard({
  appointment,
}: {
  appointment: ClientAppointment;
}): React.ReactElement {
  return (
    <article className="market-card compact-card">
      <div className="card-body">
        <div className="card-title-row">
          <h3>{appointment.service.name}</h3>
          <AppointmentStatusBadge status={appointment.status} />
        </div>
        <p className="muted">{appointment.barber.businessName}</p>
        <p>{new Date(appointment.scheduledAt).toLocaleString()}</p>
        <p className="card-meta">${appointment.priceQuoted.toFixed(2)}</p>
        <Link className="button button-secondary" href={`/client/appointments/${appointment.id}`}>
          View
        </Link>
      </div>
    </article>
  );
}
