'use client';

import { barberDiscoveryApi } from '@barber-saas/api-client';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck2, Car, MapPin, Scissors, Search, Sparkles, Star } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ClientHeader } from '@/components/client-header';
import { BarberCard } from '@/components/client-ui';
import { browserApi } from '@/lib/browser-api';
import type { Pagination, PublicBarber } from '@/lib/contracts';

type BarberSearchResponse = { barbers: PublicBarber[]; pagination: Pagination };

export function ClientHome(): React.ReactElement {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [recentlyViewed, setRecentlyViewed] = useState<PublicBarber[]>([]);
  const featured = useQuery({
    queryKey: ['featured-barbers'],
    queryFn: () =>
      barberDiscoveryApi.search<BarberSearchResponse>(browserApi, {
        limit: 6,
        verified: true,
      }),
  });
  const mobile = useQuery({
    queryKey: ['featured-mobile-barbers'],
    queryFn: () =>
      barberDiscoveryApi.search<BarberSearchResponse>(browserApi, {
        limit: 6,
        mobileOnly: true,
        verified: true,
      }),
  });

  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem('cutg_recent_barbers') ?? '[]',
      ) as PublicBarber[];
      setRecentlyViewed(stored.slice(0, 5));
    } catch {
      localStorage.removeItem('cutg_recent_barbers');
    }
  }, []);

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim().length > 0) params.set('q', query.trim());
    router.push(`/client/barbers?${params.toString()}`);
  };

  return (
    <main className="market-page">
      <ClientHeader />

      <section className="market-hero">
        <div>
          <p className="eyebrow">Danville's barber marketplace</p>
          <h1>Find your Mobile barber.</h1>
          <p>
            Compare trusted professionals, book an open time, or have a mobile barber come to you.
          </p>
          <form className="hero-search" onSubmit={submit}>
            <Search size={18} />
            <input
              aria-label="Search by barber, city, or style"
              placeholder="Search by barber, city, or style"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className="button button-primary" type="submit">
              Search <span aria-hidden="true">→</span>
            </button>
          </form>
          <div className="quick-filter-row">
            <Link href="/client/barbers?city=Danville&state=KY">
              <MapPin size={16} /> Near me
            </Link>
            <Link href="/client/barbers?city=Danville&state=KY&mobileOnly=true">
              <Car size={16} /> Mobile barbers
            </Link>
            <Link href="/client/barbers?minRating=4">
              <Star size={16} /> Top rated
            </Link>
            <Link href="/client/barbers?category=haircut">
              <Sparkles size={16} /> Fades
            </Link>
          </div>
        </div>
      </section>

      <section className="market-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Featured</p>
            <h2>Top barbers near you</h2>
          </div>
          <Link className="text-link" href="/client/barbers">
            View all
          </Link>
        </div>
        {featured.isLoading ? (
          <div className="barber-grid">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="market-card skeleton-card" key={index} />
            ))}
          </div>
        ) : (
          <div className="barber-grid">
            {(featured.data?.barbers ?? []).map((barber) => (
              <BarberCard barber={barber} key={barber.id} />
            ))}
          </div>
        )}
      </section>

      {(mobile.data?.barbers.length ?? 0) > 0 && (
        <section className="market-section spotlight-section">
          <div className="section-title">
            <div>
              <p className="eyebrow">Mobile service</p>
              <h2>Barbers that come to you</h2>
            </div>
            <Link className="text-link" href="/client/barbers?mobileOnly=true">
              See all mobile barbers →
            </Link>
          </div>
          <div className="horizontal-card-rail">
            {mobile.data?.barbers.map((barber) => (
              <BarberCard barber={barber} key={barber.id} />
            ))}
          </div>
        </section>
      )}

      <section className="market-section design-home-band">
        <div>
          <p className="eyebrow">Design your look</p>
          <h2>Walk in with a clear vision.</h2>
          <p>Choose a style, describe the details, and attach the brief to your next booking.</p>
        </div>
        <div className="design-home-actions">
          <Link className="button button-primary" href="/client/design">
            <Sparkles size={16} /> Open Hair Design Studio
          </Link>
          <div className="style-chip-row">
            <span>Fade</span>
            <span>Taper</span>
            <span>Textured top</span>
            <span>Beard fade</span>
          </div>
        </div>
      </section>

      <section className="market-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Simple by design</p>
            <h2>From search to fresh cut</h2>
          </div>
        </div>
        <div className="how-it-works">
          <article>
            <Search size={22} />
            <span>1</span>
            <h3>Search</h3>
            <p>Browse by style, rating, location, and mobile availability.</p>
          </article>
          <article>
            <CalendarCheck2 size={22} />
            <span>2</span>
            <h3>Book</h3>
            <p>Pick your service, appointment type, and an open time.</p>
          </article>
          <article>
            <Scissors size={22} />
            <span>3</span>
            <h3>Get cut</h3>
            <p>Visit the shop or let your barber bring the setup to you.</p>
          </article>
        </div>
      </section>

      {recentlyViewed.length > 0 && (
        <section className="market-section">
          <div className="section-title">
            <div>
              <p className="eyebrow">Pick up where you left off</p>
              <h2>Recently viewed</h2>
            </div>
          </div>
          <div className="horizontal-card-rail compact-rail">
            {recentlyViewed.map((barber) => (
              <BarberCard barber={barber} key={barber.id} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
