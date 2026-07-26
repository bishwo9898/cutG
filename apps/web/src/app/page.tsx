import {
  ArrowUpRight,
  Calendar,
  Car,
  Check,
  Clock3,
  Compass,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ActivityTicker } from '@/components/landing/activity-ticker';
import { HairDesignSlider } from '@/components/landing/hair-design-slider';
import { HeroFlipWord } from '@/components/landing/hero-flip-word';
import { LandingNav } from '@/components/landing/landing-nav';
import { BarberCover } from '@/components/client/barber-cover';
import type { Pagination, PublicBarber } from '@/lib/contracts';

export const metadata: Metadata = {
  title: 'cutG - Premium barber booking, mobile service, and AI preview',
  description:
    'Book trusted barbers, preview your next cut with AI, and track mobile service in real time.',
  openGraph: {
    title: 'cutG - Your barber, wherever you are',
    description:
      'Book trusted barbers nearby, bring them to your door, and preview your next look before the appointment.',
    type: 'website',
  },
};

type SearchResponse = { barbers: PublicBarber[]; pagination: Pagination };
type ShowcaseBarber = {
  id: string;
  businessName: string;
  city: string;
  state: string;
  averageRating: number;
  totalReviews: number;
  lowestServicePrice: number;
  profilePhotoUrl: string | null;
  mobile: boolean;
};

const proofStats = [
  { value: '4.9★', label: 'Average client rating' },
  { value: '2,400+', label: 'Bookings completed' },
  { value: '12 cities', label: 'Mobile barbers live now' },
];

const steps = [
  {
    number: '01',
    title: 'Find your barber.',
    body: 'Browse by rating, specialty, or style. Filter for mobile service if you want them at your door.',
  },
  {
    number: '02',
    title: 'Book in seconds.',
    body: 'Pick your service and time. Pay securely. Your barber gets notified instantly.',
  },
  {
    number: '03',
    title: 'Get the cut.',
    body: 'At their shop or yours. Show your AI preview so the look is clear before the first pass.',
  },
];

const reviews = [
  {
    quote:
      'Booked a mobile barber to my hotel before a pitch meeting. Showed the AI preview on the way in. Perfect cut in forty minutes.',
    author: 'Marcus T.',
    city: 'New York',
  },
  {
    quote:
      'The live tracking is what sold me. I knew exactly when he was two minutes out, and the whole thing felt premium start to finish.',
    author: 'Jordan K.',
    city: 'Los Angeles',
  },
  {
    quote:
      'I doubled my monthly clients in six weeks. The mobile service setup alone gave me a cleaner business than DMs ever could.',
    author: 'Chris A.',
    city: 'Austin',
  },
];

const barberPlans = [
  {
    name: 'Free',
    subtitle: 'Just getting started',
    price: '—',
    features: ['Up to 5 services', '14-day calendar horizon', 'Client bookings'],
  },
  {
    name: 'Basic',
    subtitle: 'Growing your clientele',
    price: '$9/mo',
    features: ['Up to 20 services', 'Priority in search', '60-day slot generation'],
  },
  {
    name: 'Premium',
    subtitle: 'Full power',
    price: '$19/mo',
    featured: true,
    features: ['Unlimited services', 'Analytics access', 'Mobile service support'],
  },
];

const tickerItems = [
  { location: 'Marcus J. in Brooklyn', action: 'just booked a low taper.', time: '2 min ago' },
  { location: 'Tyler K. in Austin', action: 'just opened the AI preview.', time: '8 min ago' },
  { location: 'Nina R. in Chicago', action: 'just reserved a mobile visit.', time: '11 min ago' },
  { location: 'Sasha P. in Queens', action: 'just saved a barber for later.', time: '14 min ago' },
];

const fallbackBarbers: ShowcaseBarber[] = [
  {
    id: 'fallback-1',
    businessName: 'The Classic Room',
    city: 'Brooklyn',
    state: 'NY',
    averageRating: 5,
    totalReviews: 42,
    lowestServicePrice: 45,
    profilePhotoUrl: '/images/barbers/barber-1.webp',
    mobile: true,
  },
  {
    id: 'fallback-2',
    businessName: 'Upper Cut Studio',
    city: 'Manhattan',
    state: 'NY',
    averageRating: 4.9,
    totalReviews: 128,
    lowestServicePrice: 35,
    profilePhotoUrl: '/images/barbers/barber-2.webp',
    mobile: false,
  },
  {
    id: 'fallback-3',
    businessName: 'The Fade Shop',
    city: 'Queens',
    state: 'NY',
    averageRating: 4.8,
    totalReviews: 96,
    lowestServicePrice: 40,
    profilePhotoUrl: '/images/barbers/barber-3.webp',
    mobile: true,
  },
];

const featuredBarbers = async (): Promise<PublicBarber[]> => {
  const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:4000';
  try {
    const response = await fetch(`${baseUrl}/barbers?limit=6&verified=true`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) return [];
    return ((await response.json()) as SearchResponse).barbers;
  } catch {
    return [];
  }
};

export default async function LandingPage(): Promise<React.ReactElement> {
  const barbers = await featuredBarbers();
  const featured = (barbers.length > 0
    ? barbers.map((barber) => ({
        id: barber.id,
        businessName: barber.businessName,
        city: barber.city ?? '',
        state: barber.state ?? '',
        averageRating: barber.averageRating,
        totalReviews: barber.totalReviews,
        lowestServicePrice: barber.lowestServicePrice ?? 0,
        profilePhotoUrl: barber.profilePhotoUrl,
        mobile: barber.mobileService?.isEnabled === true,
      }))
    : fallbackBarbers) satisfies ShowcaseBarber[];

  return (
    <main className="landing-cinematic-page">
      <LandingNav />

      <section className="landing-cinematic-hero">
        <div className="landing-cinematic-aurora landing-cinematic-aurora-left" />
        <div className="landing-cinematic-aurora landing-cinematic-aurora-right" />
        <div className="landing-cinematic-shell landing-cinematic-hero-grid">
          <div className="landing-cinematic-hero-copy">
            <p className="landing-cinematic-eyebrow">Barbering, reimagined</p>
            <h1>
              Your barber, <HeroFlipWord words={['whenever', 'wherever']} /> you want
            </h1>
            <p className="landing-cinematic-hero-subhead">
              Book top barbers in minutes, bring them to your door, and preview your next look
              before you ever sit in the chair.
            </p>
            <div className="landing-cinematic-hero-actions">
              <Link className="landing-cinematic-button landing-cinematic-button-primary" href="/client/barbers">
                Find your barber <ArrowUpRight size={16} />
              </Link>
              <Link className="landing-cinematic-button landing-cinematic-button-ghost" href="/barber/register">
                I&apos;m a barber
              </Link>
            </div>
            <div className="landing-cinematic-trust-row">
              <span>
                <ShieldCheck size={15} /> Verified professionals
              </span>
              <span>
                <Clock3 size={15} /> Book in under a minute
              </span>
              <span>
                <Sparkles size={15} /> AI preview before booking
              </span>
            </div>
            <ActivityTicker items={tickerItems} />
          </div>

          <aside className="landing-cinematic-hero-stack" aria-label="Product story preview">
            <div className="landing-cinematic-surface landing-cinematic-surface-strong">
              <div className="landing-cinematic-surface-header">
                <span>Next available</span>
                <strong>Today</strong>
              </div>
              <div className="landing-cinematic-booking-card">
                <div>
                  <p>Jordan Miles</p>
                  <span>Low taper · 4.9 rating</span>
                </div>
                <span className="landing-cinematic-status-pill">Verified</span>
              </div>
              <div className="landing-cinematic-slot-row">
                <span>3:30 PM</span>
                <span>5:00 PM</span>
                <span>6:15 PM</span>
              </div>
              <div className="landing-cinematic-hero-gridline">
                <div>
                  <small>Service</small>
                  <strong>Classic fade</strong>
                </div>
                <div>
                  <small>Price</small>
                  <strong>From $38</strong>
                </div>
              </div>
            </div>

            <div className="landing-cinematic-hero-mini-grid">
              <div className="landing-cinematic-surface">
                <small>AI Hair Studio</small>
                <strong>Preview approved</strong>
                <p>Low taper, natural curl texture, beard blend attached to booking.</p>
              </div>
              <div className="landing-cinematic-surface">
                <small>Mobile service</small>
                <strong>Live arrival</strong>
                <p>Travel fee shown upfront. Barber is 12 minutes away and on the move.</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="landing-cinematic-section" id="hair-design">
        <div className="landing-cinematic-shell">
          <div className="landing-cinematic-section-heading">
            <div>
              <p className="landing-cinematic-eyebrow">AI Hair Design Studio</p>
              <h2>See it before you commit.</h2>
            </div>
            <p>
              Scan your face, pick a style, and walk in with a realistic preview attached to the
              appointment.
            </p>
          </div>
          <HairDesignSlider />
        </div>
      </section>

      <section className="landing-cinematic-section landing-cinematic-section-surface" id="tracking">
        <div className="landing-cinematic-shell landing-cinematic-tracking-grid">
          <div className="landing-cinematic-tracking-copy">
            <p className="landing-cinematic-eyebrow">Mobile Barber</p>
            <h2>The barber comes to you.</h2>
            <p>
              No more driving across town. Book a mobile barber to your home, office, or hotel,
              then follow the appointment from confirmed to arrived.
            </p>
            <div className="landing-cinematic-stat-capsules">
              <div>
                <strong>10 mi</strong>
                <span>Max travel radius</span>
              </div>
              <div>
                <strong>Live GPS</strong>
                <span>Real-time tracking</span>
              </div>
              <div>
                <strong>$0 setup</strong>
                <span>No hidden costs</span>
              </div>
            </div>
            <Link className="landing-cinematic-button landing-cinematic-button-primary" href="/client/barbers?mobileOnly=true">
              Explore mobile barbers
            </Link>
          </div>

          <div className="landing-cinematic-tracking-story">
            <div className="landing-cinematic-story-card">
              <div className="landing-cinematic-story-head">
                <div>
                  <small>Live GPS Tracking</small>
                  <strong>Know exactly when your barber arrives.</strong>
                </div>
                <span>12 min away</span>
              </div>
              <div className="landing-cinematic-map-card" aria-hidden="true">
                <div className="landing-cinematic-map-grid" />
                <div className="landing-cinematic-map-path" />
                <div className="landing-cinematic-map-home">
                  <MapPin size={18} />
                </div>
                <div className="landing-cinematic-map-barber">
                  <Car size={16} />
                  <span>On the way</span>
                </div>
              </div>
              <div className="landing-cinematic-timeline">
                {[
                  ['Booked', 'Jan 20 at 9:41 AM', true],
                  ['Confirmed', 'Jan 20 at 9:44 AM', true],
                  ['On the way', 'Jan 20 at 9:48 AM', true],
                  ['Arrived', 'Waiting for arrival'],
                  ['Done', 'Service complete'],
                ].map(([label, copy, active]) => (
                  <div className={`landing-cinematic-timeline-row${active ? ' is-active' : ''}`} key={String(label)}>
                    <span />
                    <div>
                      <strong>{label}</strong>
                      <small>{copy}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-cinematic-section" id="how-it-works">
        <div className="landing-cinematic-shell">
          <div className="landing-cinematic-section-heading landing-cinematic-section-heading-centered">
            <div>
              <p className="landing-cinematic-eyebrow">The experience</p>
              <h2>Ready in three steps.</h2>
            </div>
          </div>
          <div className="landing-cinematic-steps">
            {steps.map((step) => (
              <article key={step.number}>
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-cinematic-section landing-cinematic-featured">
        <div className="landing-cinematic-shell">
          <div className="landing-cinematic-section-heading">
            <div>
              <p className="landing-cinematic-eyebrow">The collective</p>
              <h2>Barbers clients already trust.</h2>
            </div>
            <Link className="landing-cinematic-text-link" href="/client/barbers">
              Browse all barbers
            </Link>
          </div>
          <div className="landing-cinematic-barber-grid">
            {featured.map((barber) => (
              <Link
                className="landing-cinematic-barber-card"
                href={`/client/barbers/${barber.id}`}
                key={barber.id}
              >
                <div className="landing-cinematic-barber-card-image">
                  <BarberCover alt={`${barber.businessName} portrait`} src={barber.profilePhotoUrl} />
                </div>
                <div className="landing-cinematic-barber-card-body">
                  <div className="landing-cinematic-barber-card-topline">
                    <div>
                      <h3>{barber.businessName}</h3>
                      <p>
                        {[barber.city, barber.state].filter(Boolean).join(', ') || 'Location coming soon'}
                      </p>
                    </div>
                    {barber.mobile && <span className="landing-cinematic-status-pill">Mobile</span>}
                  </div>
                  <div className="landing-cinematic-barber-card-meta">
                    <span>
                      <Star size={14} /> {barber.averageRating.toFixed(1)} ({barber.totalReviews})
                    </span>
                    <strong>From ${barber.lowestServicePrice.toFixed(0)}</strong>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-cinematic-section landing-cinematic-proof-band">
        <div className="landing-cinematic-shell">
          <div className="landing-cinematic-section-heading">
            <div>
              <p className="landing-cinematic-eyebrow">Social proof</p>
              <h2>Confidence without the hard sell.</h2>
            </div>
          </div>
          <div className="landing-cinematic-reviews">
            {reviews.map((review) => (
              <article className="landing-cinematic-review-card" key={review.author}>
                <div className="landing-cinematic-stars">
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star fill="currentColor" key={index} size={14} />
                  ))}
                </div>
                <p>{review.quote}</p>
                <strong>
                  {review.author}, {review.city}
                </strong>
              </article>
            ))}
          </div>
          <div className="landing-cinematic-proof-stats">
            {proofStats.map((stat) => (
              <div key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-cinematic-section landing-cinematic-section-surface" id="for-barbers">
        <div className="landing-cinematic-shell">
          <div className="landing-cinematic-section-heading">
            <div>
              <p className="landing-cinematic-eyebrow">For barbers</p>
              <h2>Your shop. Your rules. Your clients.</h2>
            </div>
            <p>
              cutG helps barbers get discovered, manage the book, and run mobile service without
              turning the business into chaos.
            </p>
          </div>

          <div className="landing-cinematic-barber-benefits">
            {[
              [
                Search,
                'Get discovered',
                'Clients search by style, rating, and location. Show up where they are already looking.',
              ],
              [
                Calendar,
                'Manage everything',
                'Appointments, schedule, earnings, and reviews live in one calmer operating system.',
              ],
              [
                Compass,
                'Go mobile',
                'Set the radius, fee, and travel rules that make house calls profitable.',
              ],
            ].map(([Icon, title, body]) => {
              const BenefitIcon = Icon as typeof Search;
              return (
                <article key={String(title)}>
                  <BenefitIcon size={20} />
                  <h3>{String(title)}</h3>
                  <p>{String(body)}</p>
                </article>
              );
            })}
          </div>

          <div className="landing-cinematic-pricing">
            {barberPlans.map((plan) => (
              <article className={plan.featured ? 'is-featured' : ''} key={plan.name}>
                {plan.featured && <span className="landing-cinematic-pricing-chip">Most popular</span>}
                <small>{plan.name}</small>
                <h3>{plan.subtitle}</h3>
                <strong>{plan.price}</strong>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check size={14} /> {feature}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="landing-cinematic-pricing-footer">
            <p>Clients always book free. No contracts. Cancel anytime.</p>
            <Link className="landing-cinematic-button landing-cinematic-button-primary" href="/barber/register">
              Join as a barber
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-cinematic-section">
        <div className="landing-cinematic-shell landing-cinematic-final-cta">
          <div className="landing-cinematic-final-copy">
            <p className="landing-cinematic-eyebrow">Last call</p>
            <h2>Your next great cut is waiting.</h2>
            <p>
              Browse without pressure, save the right barber, and book when the match feels right.
            </p>
          </div>
          <div className="landing-cinematic-final-grid">
            <article>
              <small>For clients</small>
              <h3>Find a barber</h3>
              <p>Browse, book, and track the visit in one place.</p>
              <Link className="landing-cinematic-button landing-cinematic-button-primary" href="/client/barbers">
                Start browsing
              </Link>
            </article>
            <article>
              <small>For barbers</small>
              <h3>Grow your business</h3>
              <p>Your schedule. Your clients. Your terms.</p>
              <Link className="landing-cinematic-button landing-cinematic-button-ghost" href="/barber/register">
                Join as a barber
              </Link>
            </article>
          </div>
        </div>
      </section>

      <footer className="landing-cinematic-footer">
        <div className="landing-cinematic-shell">
          <div className="landing-cinematic-footer-top">
            <div>
              <span className="landing-cinematic-brand">
                <span className="landing-cinematic-brand-mark">cut</span>
                <span>G</span>
              </span>
              <p>The modern barbershop experience.</p>
            </div>
            <nav>
              <Link href="/client">For clients</Link>
              <Link href="/barber/register">For barbers</Link>
              <span>Privacy</span>
              <span>Terms</span>
            </nav>
          </div>
          <small>© 2026 cutG. All rights reserved.</small>
        </div>
      </footer>
    </main>
  );
}
