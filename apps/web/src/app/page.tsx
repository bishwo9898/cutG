import {
  ArrowUpRight,
  Calendar,
  Check,
  Compass,
  MapPin,
  Scissors,
  Search,
  Star,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { HairDesignSlider } from '@/components/landing/hair-design-slider';
import { HeroFlipWord } from '@/components/landing/hero-flip-word';
import { LandingNav } from '@/components/landing/landing-nav';
import { BarberCover } from '@/components/client/barber-cover';
import type { Pagination, PublicBarber } from '@/lib/contracts';

export const metadata: Metadata = {
  title: 'cutG - Premium barber booking, mobile service, and AI preview',
  description:
    'Book trusted barbers, preview your next cut with AI, and bring premium barber service to your door.',
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
        <div className="landing-cinematic-hero-backdrop" aria-hidden="true">
          <div className="landing-cinematic-hero-backdrop-image" />
          <div className="landing-cinematic-hero-backdrop-wash" />
        </div>
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
          </div>
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
              A single realistic preview helps you align on the look before the appointment begins.
            </p>
          </div>
          <HairDesignSlider />
        </div>
      </section>

      <section className="landing-cinematic-section landing-cinematic-section-surface" id="tracking">
        <div className="landing-cinematic-shell landing-cinematic-tracking-grid">
          <div className="landing-cinematic-tracking-copy">
            <p className="landing-cinematic-eyebrow">Mobile appointments</p>
            <h2>Your barber, at your place.</h2>
            <p>
              Book a barber to your home, office, or hotel and get a smoother, more concierge-like
              experience from confirmation to doorstep arrival.
            </p>
            <div className="landing-cinematic-stat-capsules">
              <div>
                <strong>Home</strong>
                <span>Private appointments at your place</span>
              </div>
              <div>
                <strong>Office</strong>
                <span>Built for lunch breaks and workdays</span>
              </div>
              <div>
                <strong>Hotel</strong>
                <span>Travel pricing and window shown upfront</span>
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
                  <small>Doorstep service</small>
                  <strong>From booked to doorstep, the visit feels handled.</strong>
                </div>
                <span>Today · 3–5 PM</span>
              </div>
              <div className="landing-cinematic-map-card" aria-hidden="true">
                <div className="landing-cinematic-map-aura landing-cinematic-map-aura-left" />
                <div className="landing-cinematic-map-aura landing-cinematic-map-aura-right" />
                <div className="landing-cinematic-map-grid" />
                <div className="landing-cinematic-map-path" />
                <div className="landing-cinematic-map-stop landing-cinematic-map-stop-origin">
                  <span className="landing-cinematic-map-stop-icon">
                    <Scissors size={15} />
                  </span>
                  <div>
                    <strong>Barber studio</strong>
                    <small>Kit packed</small>
                  </div>
                </div>
                <div className="landing-cinematic-map-stop landing-cinematic-map-stop-destination">
                  <span className="landing-cinematic-map-stop-icon">
                    <MapPin size={15} />
                  </span>
                  <div>
                    <strong>Your place</strong>
                    <small>Home / office / hotel</small>
                  </div>
                </div>
                <div className="landing-cinematic-map-route-pill">On the way · 12 min</div>
                <div className="landing-cinematic-map-service-note">Chair-ready setup</div>
              </div>
              <div className="landing-cinematic-timeline">
                {[
                  ['Booked', 'Service and travel fee locked in', true],
                  ['Confirmed', 'Barber accepted the appointment', true],
                  ['Travel set', 'Arrival window shared with the client', true],
                  ['En route', 'Headed to the location'],
                  ['At your door', 'Service begins on arrival'],
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
              <p>Browse, book, and manage the visit in one place.</p>
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
