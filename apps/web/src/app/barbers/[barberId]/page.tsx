'use client';

import { barberDiscoveryApi, clientApi } from '@barber-saas/api-client';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Award,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Car,
  Check,
  Clock3,
  Heart,
  Languages,
  MapPin,
  Navigation,
  Scissors,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { BarberCover } from '@/components/client/barber-cover';
import { ServiceAreaMap } from '@/components/client/service-area-map';
import { ClientHeader } from '@/components/client-header';
import { ReviewCard, SlotPicker } from '@/components/client-ui';
import { Notice } from '@/components/notice';
import { BeforeAfterSlider } from '@/components/portfolio/before-after-slider';
import { browserApi } from '@/lib/browser-api';
import type {
  BarberPortfolio,
  Pagination,
  PortfolioCategory,
  PublicBarber,
  PublicService,
  PublicSlot,
  Review,
} from '@/lib/contracts';

type Profile = {
  id: string;
  businessName: string;
  headline: string | null;
  businessType: 'INDEPENDENT' | 'SHOP';
  bio: string | null;
  yearsOfExperience: number | null;
  languages: string[];
  specialties: string[];
  averageRating: number;
  totalReviews: number;
  totalClients: number;
  profilePhotoUrl: string | null;
  bannerUrl: string | null;
  bannerAssetType: 'image' | 'video' | null;
  city: string | null;
  state: string | null;
  shopLocation: {
    address: string;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    latitude: number;
    longitude: number;
  } | null;
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
type BookingTab = 'services' | 'availability' | 'reviews';
type GalleryFilter = 'ALL' | PortfolioCategory;

const categoryLabels: Record<PortfolioCategory, string> = {
  BURST_FADE: 'Burst fade',
  MID_FADE: 'Mid fade',
  LOW_FADE: 'Low fade',
  HIGH_FADE: 'High fade',
  TAPER: 'Taper',
  CURLY: 'Curly',
  AFRO: 'Afro',
  BEARD: 'Beard',
  SCISSOR_CUTS: 'Scissor cuts',
  KIDS: 'Kids',
  LONG_HAIR: 'Long hair',
  DESIGNS: 'Designs',
};

const titleCase = (value: string): string =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');

const nextAppointmentLabel = (
  appointment: BarberPortfolio['nextAvailableAppointment'],
): string | null => {
  if (appointment === null || appointment === undefined) return null;
  const date = new Date(`${appointment.date}T${appointment.startTime}:00`);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const monthLabel = (month: string): string =>
  new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(`${month}-01T12:00:00`));

export default function BarberProfilePage(): React.ReactElement {
  const params = useParams<{ barberId: string }>();
  const barberId = params.barberId;
  const designId = useSearchParams().get('designId');
  const designQuery = designId === null ? '' : `?designId=${designId}`;
  const [tab, setTab] = useState<BookingTab>('services');
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>('ALL');
  const profile = useQuery({
    queryKey: ['public-barber', barberId],
    queryFn: () => barberDiscoveryApi.getProfile<Profile>(browserApi, barberId),
  });
  const portfolio = useQuery({
    queryKey: ['public-barber-portfolio', barberId],
    queryFn: () => barberDiscoveryApi.getPortfolio<BarberPortfolio>(browserApi, barberId),
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

  const galleryCategories = useMemo(
    () => [...new Set((portfolio.data?.items ?? []).map((item) => item.category))],
    [portfolio.data?.items],
  );
  const visibleWork =
    galleryFilter === 'ALL'
      ? (portfolio.data?.items ?? [])
      : (portfolio.data?.items ?? []).filter((item) => item.category === galleryFilter);
  const maximumRepeat = Math.max(
    1,
    ...(portfolio.data?.trust.monthlyRepeatClients.map((item) => item.repeatClients) ?? []),
  );

  if (profile.isLoading) return <div className="loading">Loading barber...</div>;
  if (profile.data === undefined) return <div className="loading">Barber not found.</div>;

  const location =
    profile.data.shopLocation === null
      ? [profile.data.city, profile.data.state].filter(Boolean).join(', ')
      : [
          profile.data.shopLocation.address,
          profile.data.shopLocation.city,
          profile.data.shopLocation.state,
        ]
          .filter(Boolean)
          .join(', ');
  const appointmentLabel = nextAppointmentLabel(portfolio.data?.nextAvailableAppointment);
  const serviceMode =
    profile.data.mobileService !== null && profile.data.shopLocation !== null
      ? 'Mobile & in-shop'
      : profile.data.mobileService !== null
        ? 'Mobile barber'
        : profile.data.shopLocation !== null
          ? 'In-shop'
          : profile.data.businessType === 'SHOP'
            ? 'Shop barber'
            : 'Independent barber';

  return (
    <main className="market-page public-portfolio-page">
      <ClientHeader />

      <section className="portfolio-public-hero">
        <div className="portfolio-hero-media">
          {profile.data.bannerUrl !== null &&
            (profile.data.bannerAssetType === 'video' ? (
              <video autoPlay loop muted playsInline src={profile.data.bannerUrl} />
            ) : (
              <img
                alt={`${profile.data.businessName} portfolio banner`}
                src={profile.data.bannerUrl}
              />
            ))}
          <div className="portfolio-hero-shade" />
          <span className="portfolio-hero-mode">
            {profile.data.mobileService !== null ? <Car size={15} /> : <Store size={15} />}
            {serviceMode}
          </span>
        </div>
        <div className="portfolio-hero-profile">
          <BarberCover
            alt={`${profile.data.businessName} profile`}
            className="portfolio-avatar"
            priority
            src={profile.data.profilePhotoUrl}
          />
          <div className="portfolio-hero-copy">
            <div className="portfolio-title-row">
              <div>
                <p className="eyebrow">
                  {profile.data.businessType === 'SHOP'
                    ? 'Barbershop portfolio'
                    : 'Barber portfolio'}
                </p>
                <h1>{profile.data.businessName}</h1>
              </div>
              {profile.data.isVerified && (
                <span className="portfolio-verified-badge">
                  <ShieldCheck size={16} /> Verified
                </span>
              )}
            </div>
            {profile.data.headline !== null && (
              <p className="portfolio-headline">
                {profile.data.headline}
                {profile.data.yearsOfExperience === null
                  ? ''
                  : ` · ${profile.data.yearsOfExperience} years`}
              </p>
            )}
            <div className="portfolio-hero-facts">
              <span>
                <Star fill="currentColor" size={16} />
                <strong>{profile.data.averageRating.toFixed(2)}</strong>
                <small>({profile.data.totalReviews} reviews)</small>
              </span>
              {location.length > 0 && (
                <span>
                  <MapPin size={16} /> {location}
                </span>
              )}
              {profile.data.languages.length > 0 && (
                <span>
                  <Languages size={16} /> {profile.data.languages.join(', ')}
                </span>
              )}
            </div>
            {profile.data.bio !== null && <p className="portfolio-bio">{profile.data.bio}</p>}
            {profile.data.specialties.length > 0 && (
              <div className="portfolio-specialty-list">
                {profile.data.specialties.map((specialty) => (
                  <span key={specialty}>{specialty}</span>
                ))}
              </div>
            )}
          </div>
          <aside className="portfolio-booking-card">
            <p className="eyebrow">Next opening</p>
            <strong>{appointmentLabel ?? 'Schedule coming soon'}</strong>
            <span>
              <Clock3 size={15} />
              {appointmentLabel === null ? 'Check availability below' : 'Appointments fill quickly'}
            </span>
            <Link
              className="button button-primary button-full"
              href={`/client/barbers/${barberId}/book${designQuery}`}
            >
              Book now
            </Link>
            <div>
              <button
                disabled={save.isPending || save.isSuccess}
                onClick={() => save.mutate()}
                type="button"
              >
                <Heart fill={save.isSuccess ? 'currentColor' : 'none'} size={16} />
                {save.isSuccess ? 'Saved' : 'Save'}
              </button>
              <button
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
          </aside>
        </div>
      </section>

      <nav className="portfolio-section-nav" aria-label="Barber profile sections">
        <a href="#work">Work</a>
        <a href="#trust">Customer loyalty</a>
        <a href="#experience">Experience</a>
        <a href="#book">Services & booking</a>
      </nav>

      {(portfolio.data?.items.length ?? 0) > 0 && (
        <section className="portfolio-public-section portfolio-work-section" id="work">
          <div className="portfolio-public-heading">
            <div>
              <p className="eyebrow">Selected work</p>
              <h2>Find your hair in the gallery</h2>
              <p>Drag each image to compare. Filter by the kind of cut you are considering.</p>
            </div>
            <span>{portfolio.data?.items.length} transformations</span>
          </div>
          <div className="portfolio-filter-row" role="group" aria-label="Filter haircut gallery">
            <button
              className={galleryFilter === 'ALL' ? 'is-active' : ''}
              onClick={() => setGalleryFilter('ALL')}
              type="button"
            >
              All work
            </button>
            {galleryCategories.map((category) => (
              <button
                className={galleryFilter === category ? 'is-active' : ''}
                key={category}
                onClick={() => setGalleryFilter(category)}
                type="button"
              >
                {categoryLabels[category]}
              </button>
            ))}
          </div>
          <div className="portfolio-work-grid">
            {visibleWork.map((item) => (
              <article className="portfolio-work-card" key={item.id}>
                {item.beforeImageUrl !== null && item.afterImageUrl !== null && (
                  <BeforeAfterSlider
                    afterUrl={item.afterImageUrl}
                    beforeUrl={item.beforeImageUrl}
                    title={item.title}
                  />
                )}
                <div className="portfolio-work-copy">
                  <div className="portfolio-work-kicker">
                    <span>{categoryLabels[item.category]}</span>
                    <span>{titleCase(item.difficulty)}</span>
                  </div>
                  <h3>{item.title}</h3>
                  {item.description !== null && <p>{item.description}</p>}
                  <dl className="portfolio-hair-profile">
                    <div>
                      <dt>Hair</dt>
                      <dd>
                        {titleCase(item.hairType)} · {titleCase(item.hairDensity)}
                      </dd>
                    </div>
                    <div>
                      <dt>Length</dt>
                      <dd>
                        {item.hairLengthBefore} → {item.hairLengthAfter}
                      </dd>
                    </div>
                    <div>
                      <dt>Face shape</dt>
                      <dd>{titleCase(item.faceShape)}</dd>
                    </div>
                    <div>
                      <dt>Technique</dt>
                      <dd>{item.cutStyle}</dd>
                    </div>
                    <div>
                      <dt>Time</dt>
                      <dd>{item.timeTakenMinutes} minutes</dd>
                    </div>
                  </dl>
                  {item.productsUsed.length > 0 && (
                    <div className="portfolio-products">
                      <strong>Products used</strong>
                      <span>{item.productsUsed.join(' · ')}</span>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="portfolio-public-section portfolio-trust-section" id="trust">
        <div className="portfolio-public-heading">
          <div>
            <p className="eyebrow">Proven client loyalty</p>
            <h2>Work people come back for</h2>
            <p>Calculated from completed cutG appointments—never manually entered.</p>
          </div>
        </div>
        <div className="portfolio-trust-grid">
          <article className="portfolio-repeat-stat">
            <span>
              <UsersRound size={20} />
            </span>
            <strong>
              {portfolio.data?.trust.repeatClientPercentage === null ||
              portfolio.data?.trust.repeatClientPercentage === undefined
                ? 'New'
                : `${portfolio.data.trust.repeatClientPercentage}%`}
            </strong>
            <h3>
              {portfolio.data?.trust.repeatClientPercentage === null ||
              portfolio.data?.trust.repeatClientPercentage === undefined
                ? 'Customer history is building'
                : 'return within 60 days'}
            </h3>
            <p>
              {portfolio.data?.trust.totalClients ?? 0} verified{' '}
              {(portfolio.data?.trust.totalClients ?? 0) === 1 ? 'client' : 'clients'} served
              through cutG
            </p>
          </article>
          <article className="portfolio-retention-chart">
            <div>
              <span>
                <BarChart3 size={18} />
              </span>
              <div>
                <h3>Monthly repeat customers</h3>
                <p>Last six months</p>
              </div>
            </div>
            <div className="portfolio-chart-bars" aria-label="Monthly repeat customers graph">
              {portfolio.data?.trust.monthlyRepeatClients.map((item) => (
                <div key={item.month}>
                  <span>{item.repeatClients}</span>
                  <i
                    style={{
                      height: `${Math.max(6, (item.repeatClients / maximumRepeat) * 100)}%`,
                    }}
                  />
                  <small>{monthLabel(item.month)}</small>
                </div>
              ))}
            </div>
          </article>
          <article className="portfolio-trust-note">
            <Sparkles size={21} />
            <h3>Good fit matters</h3>
            <p>
              Use the gallery’s hair type, density, and face shape details to find work closest to
              what you need.
            </p>
            <a href="#work">Explore the work</a>
          </article>
        </div>
      </section>

      {((portfolio.data?.experiences.length ?? 0) > 0 ||
        (portfolio.data?.certifications.length ?? 0) > 0) && (
        <section className="portfolio-public-section portfolio-career-section" id="experience">
          <div className="portfolio-public-heading">
            <div>
              <p className="eyebrow">Professional background</p>
              <h2>Experience behind the chair</h2>
            </div>
          </div>
          <div className="portfolio-public-career-grid">
            {(portfolio.data?.experiences.length ?? 0) > 0 && (
              <div>
                <div className="portfolio-career-title">
                  <BriefcaseBusiness size={18} />
                  <h3>Work experience</h3>
                </div>
                <div className="portfolio-public-timeline">
                  {portfolio.data?.experiences.map((item) => (
                    <article key={item.id}>
                      <span />
                      <div>
                        <h4>{item.title}</h4>
                        <strong>{item.shopName}</strong>
                        <p>
                          {item.startDate.slice(0, 4)} –{' '}
                          {item.isCurrent ? 'Present' : item.endDate?.slice(0, 4)}
                          {item.location === null ? '' : ` · ${item.location}`}
                        </p>
                        {item.description !== null && <small>{item.description}</small>}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
            {(portfolio.data?.certifications.length ?? 0) > 0 && (
              <div>
                <div className="portfolio-career-title">
                  <Award size={18} />
                  <h3>Licenses & certifications</h3>
                </div>
                <div className="portfolio-public-certifications">
                  {portfolio.data?.certifications.map((item) => (
                    <article key={item.id}>
                      <span>
                        <Check size={17} />
                      </span>
                      <div>
                        <h4>{item.name}</h4>
                        <strong>{item.issuer}</strong>
                        <p>
                          {item.issueDate === null
                            ? 'Credentialed'
                            : `Issued ${item.issueDate.slice(0, 4)}`}
                        </p>
                        {item.credentialUrl !== null && (
                          <a href={item.credentialUrl} rel="noreferrer" target="_blank">
                            View credential
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="portfolio-public-section portfolio-book-section" id="book">
        <div className="portfolio-public-heading">
          <div>
            <p className="eyebrow">Ready when you are</p>
            <h2>Choose how you want to book</h2>
          </div>
        </div>

        {profile.data.mobileService?.isEnabled === true && (
          <section className="portfolio-mobile-service">
            <span>
              <Car size={22} />
            </span>
            <div>
              <p className="eyebrow">Mobile service available</p>
              <h3>Have {profile.data.businessName} come to you</h3>
              <p>
                Up to {profile.data.mobileService.serviceRadiusMiles} miles ·{' '}
                {profile.data.mobileService.travelFeeStructure === 'flat'
                  ? `$${profile.data.mobileService.baseFee.toFixed(2)} flat travel fee`
                  : 'Travel fee calculated by distance'}
              </p>
            </div>
            <Link
              className="button button-primary"
              href={`/client/barbers/${barberId}/book${designQuery}`}
            >
              Book mobile
            </Link>
          </section>
        )}

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
              {titleCase(item)}
            </button>
          ))}
        </div>
        {tab === 'services' && (
          <div className="portfolio-service-list">
            {(services.data?.services ?? []).map((service) => (
              <article className={service.imageUrl === null ? '' : 'has-image'} key={service.id}>
                {service.imageUrl !== null && (
                  <img alt={`${service.name} service`} src={service.imageUrl} />
                )}
                <span className="portfolio-service-icon">
                  <Scissors size={18} />
                </span>
                <div>
                  <h3>{service.name}</h3>
                  {service.description !== null && <p>{service.description}</p>}
                  <small>
                    <Clock3 size={14} /> {service.durationMinutes} min · {service.category}
                  </small>
                </div>
                <strong>${service.price.toFixed(2)}</strong>
                <Link
                  className="button button-secondary"
                  href={`/client/barbers/${barberId}/book?serviceId=${service.id}${designId === null ? '' : `&designId=${designId}`}`}
                >
                  Book
                </Link>
              </article>
            ))}
          </div>
        )}
        {tab === 'availability' && (
          <div className="portfolio-tab-panel">
            <div className="section-title">
              <h3>Next available appointments</h3>
              <CalendarDays size={20} />
            </div>
            <SlotPicker slots={slots.data?.slots ?? []} onSelect={() => undefined} />
          </div>
        )}
        {tab === 'reviews' && (
          <div className="portfolio-tab-panel">
            <div className="section-title">
              <h3>Customer reviews</h3>
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

      {profile.data.shopLocation !== null && (
        <section className="portfolio-public-section portfolio-shop-section">
          <div className="portfolio-shop-copy">
            <span>
              <MapPin size={20} />
            </span>
            <p className="eyebrow">Visit the shop</p>
            <h2>Know exactly where to arrive</h2>
            <p>
              {[
                profile.data.shopLocation.address,
                profile.data.shopLocation.city,
                profile.data.shopLocation.state,
                profile.data.shopLocation.zipCode,
              ]
                .filter(Boolean)
                .join(', ')}
            </p>
            <a
              className="button button-secondary"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${profile.data.shopLocation.latitude},${profile.data.shopLocation.longitude}`,
              )}`}
              rel="noreferrer"
              target="_blank"
            >
              <Navigation size={16} /> Get directions
            </a>
          </div>
          <div className="portfolio-shop-map">
            <ServiceAreaMap
              center={{
                latitude: profile.data.shopLocation.latitude,
                longitude: profile.data.shopLocation.longitude,
              }}
              destination={{
                latitude: profile.data.shopLocation.latitude,
                longitude: profile.data.shopLocation.longitude,
              }}
              interactive={false}
              markerVariant="store"
              radiusMiles={null}
              zoom={14}
            />
          </div>
        </section>
      )}

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
