'use client';

import { barberDiscoveryApi, clientApi } from '@barber-saas/api-client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarDays, Car, Heart, MapPin, Share2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { BarberCover } from '@/components/client/barber-cover';
import { ClientHeader } from '@/components/client-header';
import { ReviewCard, SlotPicker, StarRating } from '@/components/client-ui';
import { Notice } from '@/components/notice';
import { browserApi } from '@/lib/browser-api';
import type { Pagination, PublicBarber, PublicService, PublicSlot, Review } from '@/lib/contracts';

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
  mobileService: {
    isEnabled: true;
    serviceRadiusMiles: number;
    travelFeeStructure: string;
    baseFee: number;
    notes: string | null;
  } | null;
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
  const designId = useSearchParams().get('designId');
  const designQuery = designId === null ? '' : `?designId=${designId}`;
  const [tab, setTab] = useState<'services' | 'availability' | 'reviews'>('services');
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

  useEffect(() => {
    if (profile.data === undefined || services.data === undefined) return;
    const item: PublicBarber = {
      id: profile.data.id,
      businessName: profile.data.businessName,
      bio: profile.data.bio,
      profilePhotoUrl: profile.data.profilePhotoUrl,
      city: profile.data.city,
      state: profile.data.state,
      averageRating: profile.data.averageRating,
      totalReviews: profile.data.totalReviews,
      isVerified: profile.data.isVerified,
      subscriptionTier: profile.data.subscriptionTier as PublicBarber['subscriptionTier'],
      lowestServicePrice:
        services.data.services.length === 0
          ? null
          : Math.min(...services.data.services.map((service) => service.price)),
      serviceCategories: [...new Set(services.data.services.map((service) => service.category))],
      nextAvailableSlot: slots.data?.slots.find((slot) => slot.isAvailable)?.date ?? null,
      mobileService:
        profile.data.mobileService === null
          ? null
          : {
              isEnabled: true,
              serviceRadiusMiles: profile.data.mobileService.serviceRadiusMiles,
              travelFeeStructure: profile.data.mobileService.travelFeeStructure as
                'flat' | 'per_mile' | 'free',
              baseFee: profile.data.mobileService.baseFee,
              perMileRate: null,
              notes: profile.data.mobileService.notes,
            },
    };
    try {
      const previous = JSON.parse(
        localStorage.getItem('cutg_recent_barbers') ?? '[]',
      ) as PublicBarber[];
      localStorage.setItem(
        'cutg_recent_barbers',
        JSON.stringify([item, ...previous.filter((barber) => barber.id !== item.id)].slice(0, 5)),
      );
    } catch {
      localStorage.setItem('cutg_recent_barbers', JSON.stringify([item]));
    }
  }, [profile.data, services.data, slots.data?.slots]);

  if (profile.isLoading) return <div className="loading">Loading barber...</div>;
  if (profile.data === undefined) return <div className="loading">Barber not found.</div>;

  return (
    <main className="market-page">
      <ClientHeader />

      <section className="profile-hero">
        <BarberCover
          alt={`${profile.data.businessName} barbershop`}
          className="profile-photo"
          priority
          src={profile.data.profilePhotoUrl}
        />
        <div>
          <p className="eyebrow">{profile.data.isVerified ? 'Verified barber' : 'Barber'}</p>
          {profile.data.mobileService?.isEnabled === true && (
            <span className="mobile-badge">Mobile service available</span>
          )}
          <h1>{profile.data.businessName}</h1>
          {profile.data.isVerified && (
            <p className="verified-line">
              <ShieldCheck size={17} /> Identity verified
            </p>
          )}
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
            <Link
              className="button button-primary"
              href={`/client/barbers/${barberId}/book${designQuery}`}
            >
              Book now
            </Link>
            <button
              className="button button-secondary"
              disabled={save.isPending || save.isSuccess}
              onClick={() => save.mutate()}
              type="button"
            >
              <Heart fill={save.isSuccess ? 'currentColor' : 'none'} size={16} />{' '}
              {save.isSuccess ? 'Saved' : 'Save barber'}
            </button>
            <button
              className="button button-ghost"
              onClick={() =>
                void navigator.share?.({
                  title: profile.data?.businessName,
                  url: window.location.href,
                })
              }
              type="button"
            >
              <Share2 size={16} /> Share
            </button>
          </div>
          {save.error instanceof Error && <Notice>{save.error.message}</Notice>}
        </div>
      </section>

      {profile.data.mobileService?.isEnabled === true && (
        <section className="mobile-service-callout">
          <Car size={26} />
          <div>
            <p className="eyebrow">Mobile service available</p>
            <h2>This barber travels to you</h2>
            <p>
              Service area up to {profile.data.mobileService.serviceRadiusMiles} miles ·{' '}
              {profile.data.mobileService.travelFeeStructure === 'flat'
                ? `$${profile.data.mobileService.baseFee.toFixed(2)} flat travel fee`
                : 'Fee based on distance'}
            </p>
            {profile.data.mobileService.notes !== null && (
              <small>{profile.data.mobileService.notes}</small>
            )}
          </div>
          <Link
            className="button button-primary"
            href={`/client/barbers/${barberId}/book${designQuery}`}
          >
            Book mobile service
          </Link>
        </section>
      )}

      <section className="market-section profile-tabs-section">
        <div className="profile-tabs" role="tablist">
          {(['services', 'availability', 'reviews'] as const).map((item) => (
            <button
              aria-selected={tab === item}
              className={tab === item ? 'is-active' : ''}
              key={item}
              onClick={() => setTab(item)}
              role="tab"
              type="button"
            >
              {item[0]?.toUpperCase()}
              {item.slice(1)}
            </button>
          ))}
        </div>
        {tab === 'services' && (
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
                  <div className="service-row-actions">
                    <strong>${service.price.toFixed(2)}</strong>
                    <Link
                      className="button button-secondary"
                      href={`/client/barbers/${barberId}/book?serviceId=${service.id}${designId === null ? '' : `&designId=${designId}`}`}
                    >
                      Book
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
        {tab === 'availability' && (
          <div>
            <div className="section-title">
              <h2>Availability</h2>
              <CalendarDays size={20} />
            </div>
            <SlotPicker slots={slots.data?.slots ?? []} onSelect={() => undefined} />
          </div>
        )}
        {tab === 'reviews' && (
          <div>
            <div className="section-title">
              <h2>Reviews</h2>
              <p className="muted">{reviews.data?.summary.totalReviews ?? 0} total</p>
            </div>
            <div className="review-grid">
              {(reviews.data?.reviews ?? []).map((review) => (
                <ReviewCard review={review} key={review.id} />
              ))}
            </div>
          </div>
        )}
      </section>
      <div className="client-mobile-booking-bar">
        <button aria-label="Save barber" onClick={() => save.mutate()} type="button">
          <Heart fill={save.isSuccess ? 'currentColor' : 'none'} size={20} />
        </button>
        <Link
          className="button button-primary"
          href={`/client/barbers/${barberId}/book${designQuery}`}
        >
          Book appointment
        </Link>
      </div>
    </main>
  );
}
