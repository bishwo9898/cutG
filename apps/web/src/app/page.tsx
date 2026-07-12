import { CalendarCheck, MapPin, Search, Scissors, Store, TrendingUp } from 'lucide-react';
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
          <Link href="#how-it-works">How it works</Link>
          <Link href="#for-barbers">For barbers</Link>
          <Link href="/client/login">Client sign in</Link>
          <Link className="button button-secondary" href="/barber/login">
            Barber portal
          </Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-content">
          <p className="eyebrow">Book the chair or bring it to you</p>
          <h1>Your barber, wherever you are.</h1>
          <p>
            Book top barbers near you, or bring professional service to your home, office, or hotel.
          </p>
          <div className="button-row">
            <Link className="button button-primary" href="/client/register">
              Find a barber
            </Link>
            <Link className="button landing-outline-button" href="/barber/register">
              I&apos;m a barber
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-section" id="how-it-works">
        <div className="landing-section-heading">
          <p className="eyebrow">Simple from search to service</p>
          <h2>How cutG works</h2>
        </div>
        <div className="landing-steps">
          {[
            [Search, 'Discover', 'Search nearby barbers by style, rating, and price.'],
            [CalendarCheck, 'Book', 'Choose your service, time, and appointment location.'],
            [Scissors, 'Get your cut', 'Visit the shop or have your barber come to you.'],
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
          <p className="eyebrow">Mobile barber service</p>
          <h2>The barber comes to you.</h2>
          <p>
            Skip the commute. Choose an address, see the travel price before booking, and follow
            each visit from confirmed to arrived.
          </p>
          <Link className="button button-primary" href="/client/barbers?mobileOnly=true">
            Find mobile barbers
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
          <p className="eyebrow">Built for independent barbers</p>
          <h2>Grow your barbering business.</h2>
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
          Join as a barber
        </Link>
      </section>

      <section className="landing-section pricing-preview">
        <div>
          <p className="eyebrow">Plans that grow with you</p>
          <h2>Start free. Upgrade when you&apos;re ready.</h2>
        </div>
        <div className="tier-preview">
          <span>Free</span>
          <span>Basic</span>
          <span>Premium</span>
        </div>
        <Link className="button button-secondary" href="/barber/register">
          Create a barber account
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
