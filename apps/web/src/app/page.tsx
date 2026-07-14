import {
  ArrowUpRight,
  CalendarCheck,
  Check,
  Clock3,
  MapPin,
  Search,
  Scissors,
  ShieldCheck,
  Store,
  TrendingUp,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { BarberCard } from '@/components/client-ui';
import type { Pagination, PublicBarber } from '@/lib/contracts';

export const metadata: Metadata = {
  title: 'cutG - Book Barbers Near You or Bring Them to Your Door',
  description:
    'Find top-rated barbers, book instantly, and get mobile barber service at your home or office.',
  openGraph: {
    title: 'cutG - Your barber, wherever you are',
    description: 'Book a trusted barber nearby or bring professional service to your door.',
    type: 'website',
  },
};

type SearchResponse = { barbers: PublicBarber[]; pagination: Pagination };

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
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link className="brand-lockup" href="/">
          <span className="brand-mark">
            <Scissors size={18} />
          </span>
          cutG
        </Link>
        <nav>
          <Link href="#how-it-works">The experience</Link>
          <Link href="#for-barbers">For professionals</Link>
          <Link href="/client/login">Sign in</Link>
          <Link className="button landing-nav-button" href="/client/register">
            Book a barber <ArrowUpRight size={15} />
          </Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-content">
          <p className="eyebrow">The modern barber marketplace</p>
          <h1>A better cut starts here.</h1>
          <p>
            Discover trusted barbers, reserve the right time, and choose the chair or your door—all
            in one beautifully simple experience.
          </p>
          <div className="button-row">
            <Link className="button button-primary" href="/client/register">
              Find your barber <ArrowUpRight size={17} />
            </Link>
            <Link className="button landing-outline-button" href="/barber/register">
              Join as a professional
            </Link>
          </div>
          <div className="landing-trust-row">
            <span>
              <ShieldCheck size={15} /> Verified professionals
            </span>
            <span>
              <Clock3 size={15} /> Book in under a minute
            </span>
          </div>
        </div>
        <aside className="landing-hero-card" aria-label="Sample booking">
          <div className="landing-hero-card-topline">
            <span>Next available</span>
            <strong>Today</strong>
          </div>
          <div className="landing-hero-card-profile">
            <span className="landing-hero-avatar">JM</span>
            <div>
              <strong>Jordan Miles</strong>
              <span>Fade specialist · 4.9</span>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="landing-hero-card-slots">
            <span>3:30 PM</span>
            <span>5:00 PM</span>
            <span>6:15 PM</span>
          </div>
          <div className="landing-hero-card-footer">
            <span>Classic fade</span>
            <strong>From $38</strong>
          </div>
        </aside>
      </section>

      <section className="landing-proof" aria-label="cutG advantages">
        <div>
          <strong>One place</strong>
          <span>Search, compare, and book</span>
        </div>
        <div>
          <strong>Two ways</strong>
          <span>In-shop or mobile service</span>
        </div>
        <div>
          <strong>Zero guesswork</strong>
          <span>Clear services and pricing</span>
        </div>
      </section>

      <section className="landing-section" id="how-it-works">
        <div className="landing-section-heading">
          <p className="eyebrow">Designed around your day</p>
          <h2>Your next cut, without the back-and-forth.</h2>
        </div>
        <div className="landing-steps">
          {[
            [
              Search,
              'Find your match',
              'Explore nearby professionals by style, rating, service, and price.',
            ],
            [
              CalendarCheck,
              'Choose your time',
              'See real availability and reserve the appointment that fits your day.',
            ],
            [
              Scissors,
              'Leave looking sharp',
              'Take the chair or have a mobile barber bring the experience to you.',
            ],
          ].map(([Icon, title, copy]) => {
            const StepIcon = Icon as typeof Search;
            return (
              <article key={String(title)}>
                <StepIcon size={22} />
                <h3>{String(title)}</h3>
                <p>{String(copy)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-mobile-band">
        <div className="landing-mobile-copy">
          <p className="eyebrow">The chair, reimagined</p>
          <h2>Great service. Your address.</h2>
          <p>
            Skip the commute. Choose an address, see the travel price before booking, and follow
            each visit from confirmed to arrived.
          </p>
          <Link className="button button-primary" href="/client/barbers?mobileOnly=true">
            Explore mobile barbers <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="landing-map-scene" aria-hidden="true">
          <span className="map-route" />
          <span className="map-origin">
            <Store size={20} />
          </span>
          <span className="map-destination">
            <MapPin size={24} />
          </span>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-heading split-heading">
          <div>
            <p className="eyebrow">Featured</p>
            <h2>Barbers clients trust</h2>
          </div>
          <Link className="text-link" href="/client/barbers">
            Browse all barbers
          </Link>
        </div>
        {barbers.length === 0 ? (
          <p className="muted">Featured barbers will appear when the API is running.</p>
        ) : (
          <div className="featured-strip">
            {barbers.map((barber) => (
              <BarberCard barber={barber} key={barber.id} />
            ))}
          </div>
        )}
      </section>

      <section className="landing-barber-band" id="for-barbers">
        <div className="landing-section-heading">
          <p className="eyebrow">Your craft. Your business.</p>
          <h2>A calmer way to run a busier chair.</h2>
        </div>
        <div className="landing-benefits">
          <article>
            <Search size={21} />
            <h3>Get discovered</h3>
            <p>Show up when nearby clients search for their next barber.</p>
          </article>
          <article>
            <CalendarCheck size={21} />
            <h3>Manage everything</h3>
            <p>Keep bookings, availability, services, and earnings organized.</p>
          </article>
          <article>
            <TrendingUp size={21} />
            <h3>Go mobile</h3>
            <p>Offer home visits with clear travel areas and fees.</p>
          </article>
        </div>
        <Link className="button button-primary" href="/barber/register">
          Build your business on cutG <ArrowUpRight size={16} />
        </Link>
      </section>

      <section className="landing-section pricing-preview">
        <div>
          <p className="eyebrow">Start on your terms</p>
          <h2>Everything you need to open your digital chair.</h2>
        </div>
        <div className="landing-plan-points">
          <span>
            <Check size={15} /> A polished public profile
          </span>
          <span>
            <Check size={15} /> Booking and calendar tools
          </span>
          <span>
            <Check size={15} /> Clear business insights
          </span>
        </div>
        <Link className="button button-secondary" href="/barber/register">
          Start free <ArrowUpRight size={16} />
        </Link>
      </section>

      <footer className="landing-footer">
        <div className="brand-lockup">
          <span className="brand-mark">
            <Scissors size={18} />
          </span>
          cutG
        </div>
        <p>Professional barbering, booked your way.</p>
        <nav>
          <Link href="/client">For clients</Link>
          <Link href="/barber/register">For barbers</Link>
          <span>Privacy</span>
          <span>Terms</span>
        </nav>
        <small>© 2026 cutG</small>
      </footer>
    </main>
  );
}
