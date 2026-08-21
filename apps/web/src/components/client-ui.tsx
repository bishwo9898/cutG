'use client';

import { clientApi } from '@barber-saas/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Car,
  CheckCircle2,
  Circle,
  Heart,
  MapPin,
  ShieldCheck,
  Star,
  Repeat2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { BarberCover } from '@/components/client/barber-cover';
import { appointmentEndsAt, formatTimeRange, slotEndsAt, slotStartsAt } from '@/lib/booking-time';
import { browserApi } from '@/lib/browser-api';
import type {
  AppointmentTimeline,
  ClientAppointment,
  PublicBarber,
  PublicSlot,
  Review,
  TravelEstimate,
} from '@/lib/contracts';

export { StaticMap } from '@/components/client/static-map';

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
  compact = false,
  showSave = false,
  query = '',
}: {
  barber: PublicBarber;
  compact?: boolean;
  showSave?: boolean;
  query?: string;
}): React.ReactElement {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: () => clientApi.saveBarber(browserApi, barber.id),
    onMutate: () => setSaved(true),
    onError: () => setSaved(false),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['saved-barbers'] }),
  });
  const nextSlot = barber.nextAvailableSlot === null ? null : new Date(barber.nextAvailableSlot);
  const availabilityLabel = ((): string => {
    if (nextSlot === null) return 'No slots available';
    const today = new Date();
    const slotDay = new Date(nextSlot.getFullYear(), nextSlot.getMonth(), nextSlot.getDate());
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const days = Math.round((slotDay.getTime() - todayDay.getTime()) / 86_400_000);
    if (days === 0) return 'Available today';
    if (days === 1) return 'Available tomorrow';
    return `Next: ${nextSlot.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  })();

  return (
    <article className={`market-card${compact ? ' market-card-compact' : ''}`}>
      <Link href={`/client/barbers/${barber.id}${query}`}>
        <BarberCover alt={`${barber.businessName} barbershop`} src={barber.profilePhotoUrl} />
        <div className="card-body">
          <div className="card-title-row">
            <h3>{barber.businessName}</h3>
            <span className="card-title-actions">
              {barber.isVerified && <ShieldCheck className="verified-icon" size={17} />}
            </span>
          </div>
          <p className="muted">
            {[barber.city, barber.state].filter(Boolean).join(', ') || 'Location coming soon'}
            {barber.distanceMiles !== null && barber.distanceMiles !== undefined
              ? ` · ${barber.distanceMiles.toFixed(1)} mi`
              : ''}
          </p>
          <div className="rating-row">
            {barber.totalReviews > 0 ? (
              <>
                <StarRating value={Math.round(barber.averageRating)} />
                <span>{barber.averageRating.toFixed(1)}</span>
                <span className="muted">({barber.totalReviews})</span>
              </>
            ) : (
              <span className="new-barber-label">New</span>
            )}
          </div>
          <p className="card-meta">
            {barber.lowestServicePrice === null
              ? 'Services being added'
              : `From $${barber.lowestServicePrice.toFixed(2)}`}
          </p>
          {!compact && barber.serviceCategories.length > 0 && (
            <p className="muted small barber-categories">
              {barber.serviceCategories.slice(0, 3).join(' · ')}
            </p>
          )}
          <p className={`availability-label${nextSlot !== null ? ' has-slots' : ''}`}>
            {availabilityLabel}
          </p>
          <div className="barber-capability-badges">
            {barber.mobileService?.isEnabled === true && (
              <span className="capability-badge is-mobile">
                <CheckCircle2 size={13} /> Mobile visits
              </span>
            )}
            {barber.onlinePaymentsAvailable === true && (
              <span className="capability-badge is-payment">
                <CheckCircle2 size={13} /> Online payments
              </span>
            )}
          </div>
        </div>
      </Link>
      <div className="market-card-actions">
        {showSave && (
          <button
            aria-label={saved ? `Saved ${barber.businessName}` : `Save ${barber.businessName}`}
            className={`button button-ghost${saved ? ' is-saved' : ''}`}
            disabled={save.isPending || saved}
            onClick={() => save.mutate()}
            type="button"
          >
            <Heart fill={saved ? 'currentColor' : 'none'} size={17} /> {saved ? 'Saved' : 'Save'}
          </button>
        )}
        <Link className="button button-primary" href={`/client/barbers/${barber.id}/book${query}`}>
          Book now
        </Link>
      </div>
    </article>
  );
}

export function SlotPicker({
  durationMinutes,
  onSelect,
  selectedId,
  slots,
  travelMinutes,
}: {
  slots: PublicSlot[];
  selectedId?: string | undefined;
  durationMinutes?: number;
  travelMinutes?: number;
  onSelect: (slot: PublicSlot) => void;
}): React.ReactElement {
  const available = useMemo(
    () =>
      slots
        .filter((slot) => slot.isAvailable)
        .sort((left, right) =>
          `${left.date}T${left.startTime}`.localeCompare(`${right.date}T${right.startTime}`),
        ),
    [slots],
  );
  const dates = useMemo(() => [...new Set(available.map((slot) => slot.date))], [available]);
  const selectedSlotDate = available.find((slot) => slot.id === selectedId)?.date;
  const [selectedDate, setSelectedDate] = useState<string | null>(
    selectedSlotDate ?? dates[0] ?? null,
  );

  useEffect(() => {
    if (selectedSlotDate !== undefined) {
      setSelectedDate(selectedSlotDate);
      return;
    }
    if (selectedDate === null || !dates.includes(selectedDate)) setSelectedDate(dates[0] ?? null);
  }, [dates, selectedDate, selectedSlotDate]);

  if (available.length === 0) return <p className="muted">No available slots for this range.</p>;
  const selectedDateIndex = selectedDate === null ? -1 : dates.indexOf(selectedDate);
  const selectedDateValue = selectedDate === null ? null : new Date(`${selectedDate}T12:00:00`);
  const selectedSlots = available.filter((slot) => slot.date === selectedDate);

  return (
    <div className="compact-calendar">
      <div className="compact-calendar-header">
        <div>
          <Calendar size={18} />
          <span>
            <strong>
              {selectedDateValue?.toLocaleDateString([], { month: 'long', year: 'numeric' })}
            </strong>
            <small>{dates.length} available days</small>
          </span>
        </div>
        <div className="compact-calendar-arrows">
          <button
            aria-label="Previous available date"
            disabled={selectedDateIndex <= 0}
            onClick={() => setSelectedDate(dates[selectedDateIndex - 1] ?? selectedDate)}
            type="button"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            aria-label="Next available date"
            disabled={selectedDateIndex < 0 || selectedDateIndex >= dates.length - 1}
            onClick={() => setSelectedDate(dates[selectedDateIndex + 1] ?? selectedDate)}
            type="button"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      <div className="compact-date-rail" role="list" aria-label="Available dates">
        {dates.map((date) => {
          const value = new Date(`${date}T12:00:00`);
          return (
            <button
              aria-pressed={selectedDate === date}
              className={selectedDate === date ? 'is-selected' : ''}
              key={date}
              onClick={() => setSelectedDate(date)}
              type="button"
            >
              <span>{value.toLocaleDateString([], { weekday: 'short' })}</span>
              <strong>{value.getDate()}</strong>
              <small>{value.toLocaleDateString([], { month: 'short' })}</small>
            </button>
          );
        })}
      </div>

      <div className="compact-time-heading">
        <strong>
          {selectedDateValue?.toLocaleDateString([], {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </strong>
        <span>{selectedSlots.length} times</span>
      </div>
      <div className="compact-time-grid">
        {selectedSlots.map((slot) => {
          const start = slotStartsAt(slot.date, slot.startTime);
          const end =
            durationMinutes === undefined
              ? slotEndsAt(slot.date, slot.endTime)
              : appointmentEndsAt(slot.date, slot.startTime, durationMinutes);
          return (
            <button
              className={selectedId === slot.id ? 'is-selected' : ''}
              key={slot.id}
              onClick={() => onSelect(slot)}
              title={formatTimeRange(start, end)}
              type="button"
            >
              <strong>
                {start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </strong>
              {durationMinutes !== undefined && <small>{durationMinutes} min</small>}
              {travelMinutes !== undefined && slot.availableForMobile === true && (
                <small>Travel-ready</small>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AppointmentStatusBadge({ status }: { status: string }): React.ReactElement {
  const label = status === 'ON_THE_WAY' ? 'On the way' : status.replaceAll('_', ' ');
  return <span className={`status-badge status-${status.toLowerCase()}`}>{label}</span>;
}

export function TravelEstimateCard({
  estimate,
  isLoading,
  errorMessage,
  outsideRadius,
}: {
  estimate?: TravelEstimate | undefined;
  isLoading: boolean;
  errorMessage?: string | undefined;
  outsideRadius?: boolean;
}): React.ReactElement | null {
  if (isLoading) {
    return (
      <div className="travel-estimate-card is-loading" role="status">
        <span className="skeleton-line" />
        <span className="skeleton-line short" />
      </div>
    );
  }
  if (errorMessage !== undefined) {
    return (
      <div className={`travel-estimate-card ${outsideRadius === true ? 'is-error' : 'is-warning'}`}>
        <MapPin size={19} />
        <div>
          <strong>
            {outsideRadius === true ? 'Outside service area' : 'Travel estimate unavailable'}
          </strong>
          <span>{errorMessage}</span>
        </div>
      </div>
    );
  }
  if (estimate === undefined) return null;
  return (
    <div className="travel-estimate-card is-success">
      <Car size={19} />
      <div>
        <strong>
          {estimate.distanceMiles.toFixed(1)} miles · about {estimate.estimatedTravelMinutes} min
        </strong>
        <span>
          ${estimate.travelFee.toFixed(2)} travel fee
          {estimate.source === 'mock' ? ' · estimated locally' : ''}
        </span>
      </div>
    </div>
  );
}

export function StatusTimeline({
  timeline,
}: {
  timeline: AppointmentTimeline;
}): React.ReactElement {
  return (
    <div className="appointment-timeline">
      <h2>Status journey</h2>
      {timeline.timeline.map((item, index) => (
        <div
          className={`timeline-row${item.done ? ' is-complete' : ''}${item.active ? ' is-current' : ''}`}
          key={item.status}
        >
          <span className="timeline-marker">
            {item.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
            {index < timeline.timeline.length - 1 && <span className="timeline-connector" />}
          </span>
          <div>
            <strong>{item.label}</strong>
            {item.at !== null && (
              <small>
                {new Date(item.at).toLocaleString([], {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </small>
            )}
          </div>
        </div>
      ))}
    </div>
  );
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
          <div>
            <p className="muted small">{appointment.barber.businessName}</p>
            <h3>{appointment.service.name}</h3>
          </div>
          <AppointmentStatusBadge status={appointment.status} />
        </div>
        <p>
          {new Date(appointment.scheduledAt).toLocaleString([], {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
        {appointment.isMobileService === true && appointment.serviceAddress != null && (
          <p className="appointment-location">
            <Car size={15} /> Mobile · {appointment.serviceAddress.addressLine1}
          </p>
        )}
        <p className="card-meta">${appointment.priceQuoted.toFixed(2)}</p>
        <div className="market-card-actions inline-actions">
          <Link className="button button-secondary" href={`/client/appointments/${appointment.id}`}>
            View details
          </Link>
          {appointment.paymentStatus === 'PENDING' && (
            <Link className="button button-primary" href={`/client/appointments/${appointment.id}`}>
              Pay now
            </Link>
          )}
          {appointment.status === 'COMPLETED' && appointment.review === null && (
            <Link
              className="button button-primary"
              href={`/client/appointments/${appointment.id}#review`}
            >
              Leave review
            </Link>
          )}
          {appointment.status === 'COMPLETED' && (
            <Link
              className="button button-secondary"
              href={`/client/barbers/${appointment.barber.id}/book?serviceId=${appointment.service.id}`}
            >
              <Repeat2 size={15} /> Book again
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
