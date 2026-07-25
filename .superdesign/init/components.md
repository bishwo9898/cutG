# Shared UI Components

Framework snapshot:

- Framework: React 19
- Meta-framework: Next.js 16 App Router
- Styling: Tailwind CSS v4 via `@import 'tailwindcss'` plus a large shared `globals.css`
- Component style: custom components, no external UI kit

This init file focuses on the reusable UI pieces that shape the public marketplace and landing experience.

## Notice

- Source: `apps/web/src/components/notice.tsx`
- Purpose: inline feedback for warnings, errors, and success states

```tsx
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function Notice({
  children,
  tone = 'error',
}: {
  children: React.ReactNode;
  tone?: 'error' | 'success' | 'warning';
}): React.ReactElement {
  return (
    <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {tone === 'error' ? (
        <AlertCircle size={18} />
      ) : tone === 'warning' ? (
        <AlertTriangle size={18} />
      ) : (
        <CheckCircle2 size={18} />
      )}
      <span>{children}</span>
    </div>
  );
}
```

## Query States

- Source: `apps/web/src/components/query-states.tsx`
- Purpose: shared loading, empty, and error presentation used in dashboard and portal screens

```tsx
import { AlertTriangle, Inbox } from 'lucide-react';

import { Notice } from './notice';

export function LoadingState(): React.ReactElement {
  return (
    <div className="loading" role="status">
      <div className="spinner" aria-label="Loading" />
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="empty-state">
      <div>
        <Inbox size={27} />
        <strong>{title}</strong>
        <span>{detail}</span>
        {action !== undefined && <div style={{ marginTop: 16 }}>{action}</div>}
      </div>
    </div>
  );
}

export function ErrorState({ message }: { message: string }): React.ReactElement {
  return (
    <div className="panel-body">
      <Notice>
        <AlertTriangle size={0} />
        {message}
      </Notice>
    </div>
  );
}
```

## Barber Cover

- Source: `apps/web/src/components/client/barber-cover.tsx`
- Purpose: resilient cover image pattern for barber cards and public profiles

```tsx
'use client';

import { Scissors } from 'lucide-react';
import { useEffect, useState } from 'react';

function resolveLegacySeedCover(src: string | null, alt: string): string | null {
  if (src === null || !src.includes('images.cutg.test')) {
    return src;
  }

  const coverNumber = [...alt].reduce((total, character) => total + character.charCodeAt(0), 0) % 3;

  return `/images/barbers/barber-${coverNumber + 1}.webp`;
}

export function BarberCover({
  alt,
  className = '',
  priority = false,
  src,
}: {
  alt: string;
  className?: string;
  priority?: boolean;
  src: string | null;
}): React.ReactElement {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = resolveLegacySeedCover(src, alt);

  useEffect(() => setFailed(false), [resolvedSrc]);

  return (
    <div className={`barber-cover ${className}`.trim()}>
      {resolvedSrc !== null && !failed ? (
        <img
          alt={alt}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          loading={priority ? 'eager' : 'lazy'}
          onError={() => setFailed(true)}
          src={resolvedSrc}
        />
      ) : (
        <div className="barber-cover-fallback" role="img" aria-label={`${alt} image unavailable`}>
          <Scissors size={32} />
          <span>cutG</span>
        </div>
      )}
    </div>
  );
}
```

## Marketplace Card Primitives

- Source: `apps/web/src/components/client-ui.tsx`
- Purpose: reusable public-facing booking cards, status chips, travel summaries, and appointment cards
- Notes: the source file also exports slot pickers and review helpers; the excerpts below are the most design-relevant shared pieces for marketplace and landing storytelling.

```tsx
export function BarberCard({
  barber,
  showSave = false,
  query = '',
}: {
  barber: PublicBarber;
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
    <article className="market-card">
      <Link href={`/client/barbers/${barber.id}${query}`}>
        <BarberCover alt={`${barber.businessName} barbershop`} src={barber.profilePhotoUrl} />
        <div className="card-body">
          <div className="card-title-row">
            <h3>{barber.businessName}</h3>
            <span className="card-title-actions">
              {barber.mobileService?.isEnabled === true && (
                <span className="mobile-badge">
                  <Car size={13} /> Mobile
                </span>
              )}
              {barber.isVerified && <ShieldCheck className="verified-icon" size={17} />}
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
          {barber.serviceCategories.length > 0 && (
            <p className="muted small barber-categories">
              {barber.serviceCategories.slice(0, 3).join(' · ')}
            </p>
          )}
          <p className={`availability-label${nextSlot !== null ? ' has-slots' : ''}`}>
            {availabilityLabel}
          </p>
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
```
