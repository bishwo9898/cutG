'use client';

import { barberDiscoveryApi, clientApi } from '@barber-saas/api-client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { ClientHeader } from '@/components/client-header';
import { ReviewCard, SlotPicker, StarRating } from '@/components/client-ui';
import { Notice } from '@/components/notice';
import { browserApi } from '@/lib/browser-api';
import type { Pagination, PublicService, PublicSlot, Review } from '@/lib/contracts';

type Profile = {
  id: string;
  businessName: string;
  bio: string | null;
  yearsOfExperience: number | null;
  averageRating: number;
  totalReviews: number;
  profilePhotoUrl: string | null;
  city: string | null;
  state: string | null;
  subscriptionTier: string;
  isVerified: boolean;
  mobileService: { isEnabled: true; baseFee: number; notes: string | null } | null;
};
type Services = { services: PublicService[] };
type Slots = { slots: PublicSlot[] };
type Reviews = {
  reviews: Review[];
  summary: { averageRating: number; totalReviews: number; distribution: Record<string, number> };
  pagination: Pagination;
};

export default function BarberProfilePage(): React.ReactElement {
  const params = useParams<{ barberId: string }>();
  const barberId = params.barberId;
  const profile = useQuery({
    queryKey: ['public-barber', barberId],
    queryFn: () => barberDiscoveryApi.getProfile<Profile>(browserApi, barberId),
  });
  const services = useQuery({
    queryKey: ['public-barber-services', barberId],
    queryFn: () => barberDiscoveryApi.getServices<Services>(browserApi, barberId),
  });
  const slots = useQuery({
    queryKey: ['public-barber-slots', barberId],
    queryFn: () => barberDiscoveryApi.getSlots<Slots>(browserApi, barberId, { days: 7 }),
  });
  const reviews = useQuery({
    queryKey: ['public-barber-reviews', barberId],
    queryFn: () => barberDiscoveryApi.getReviews<Reviews>(browserApi, barberId),
  });
  const save = useMutation({
    mutationFn: () => clientApi.saveBarber(browserApi, barberId),
  });

  if (profile.isLoading) return <div className="loading">Loading barber...</div>;
  if (profile.data === undefined) return <div className="loading">Barber not found.</div>;

  return (
    <main className="market-page">
      <ClientHeader />

      <section className="profile-hero">
        <div
          className="profile-photo"
          style={{
            backgroundImage:
              profile.data.profilePhotoUrl === null
                ? undefined
                : `url(${profile.data.profilePhotoUrl})`,
          }}
        />
        <div>
          <p className="eyebrow">{profile.data.isVerified ? 'Verified barber' : 'Barber'}</p>
          {profile.data.mobileService?.isEnabled === true && (
            <span className="mobile-badge">Mobile service available</span>
          )}
          <h1>{profile.data.businessName}</h1>
          <div className="rating-row">
            <StarRating value={Math.round(profile.data.averageRating)} />
            <span>{profile.data.averageRating.toFixed(1)}</span>
            <span className="muted">({profile.data.totalReviews} reviews)</span>
          </div>
          <p className="muted">
            <MapPin size={16} />{' '}
            {[profile.data.city, profile.data.state].filter(Boolean).join(', ')}
          </p>
          {profile.data.bio !== null && <p>{profile.data.bio}</p>}
          <div className="button-row">
            <Link className="button button-primary" href={`/client/barbers/${barberId}/book`}>
              Book now
            </Link>
            <button
              className="button button-secondary"
              disabled={save.isPending || save.isSuccess}
              onClick={() => save.mutate()}
              type="button"
            >
              {save.isSuccess ? 'Saved' : 'Save barber'}
            </button>
          </div>
          {save.error instanceof Error && <Notice>{save.error.message}</Notice>}
        </div>
      </section>

      <section className="market-section two-column">
        <div>
          <div className="section-title">
            <h2>Services</h2>
          </div>
          <div className="list-stack">
            {(services.data?.services ?? []).map((service) => (
              <article className="list-row" key={service.id}>
                <div>
                  <h3>{service.name}</h3>
                  <p className="muted">
                    {service.durationMinutes} min - {service.category}
                  </p>
                </div>
                <strong>${service.price.toFixed(2)}</strong>
              </article>
            ))}
          </div>
        </div>
        <div>
          <div className="section-title">
            <h2>Availability</h2>
            <CalendarDays size={20} />
          </div>
          <SlotPicker slots={slots.data?.slots ?? []} onSelect={() => undefined} />
        </div>
      </section>

      <section className="market-section">
        <div className="section-title">
          <h2>Reviews</h2>
          <p className="muted">{reviews.data?.summary.totalReviews ?? 0} total</p>
        </div>
        <div className="review-grid">
          {(reviews.data?.reviews ?? []).map((review) => (
            <ReviewCard review={review} key={review.id} />
          ))}
        </div>
      </section>
    </main>
  );
}
