'use client';

import { barberDiscoveryApi } from '@barber-saas/api-client';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  CalendarCheck2,
  Car,
  MapPin,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ClientHeader } from '@/components/client-header';
import { BarberCard } from '@/components/client-ui';
import { browserApi } from '@/lib/browser-api';
import type { Pagination, PublicBarber } from '@/lib/contracts';

type BarberSearchResponse = { barbers: PublicBarber[]; pagination: Pagination };

export function ClientHome(): React.ReactElement {
  const router = useRouter();
  const [query, setQuery] = useState('');
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

      <section className="market-section design-home-band design-home-band-featured">
        <div className="design-home-copy">
          <p className="eyebrow">AI Hair Design Studio</p>
          <h2>Know the look before the first cut.</h2>
          <p>
            Upload one clear photo, describe the style, and compare a realistic preview with your
            original before you book.
          </p>
          <div className="design-home-proof">
            <span>
              <ShieldCheck size={15} /> Private gallery
            </span>
            <span>
              <Sparkles size={15} /> Original vs. preview
            </span>
          </div>
          <Link className="button button-primary" href="/client/design">
            Open AI Hair Studio <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="design-home-visual" aria-hidden="true">
          <div className="design-home-visual-original">
            <span>Original</span>
          </div>
          <div className="design-home-visual-preview">
            <span>Preview</span>
          </div>
          <div className="design-home-visual-divider">
            <Sparkles size={18} />
          </div>
        </div>
      </section>

      <section className="market-section nearby-barbers-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Near you</p>
            <h2>Trusted barbers, ready when you are.</h2>
            <p className="nearby-barbers-intro">
              Verified profiles, clear pricing, and real availability in one calm view.
            </p>
          </div>
          <Link className="nearby-barbers-view-all" href="/client/barbers">
            Explore all <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="nearby-barbers-panel">
          <div className="nearby-barbers-panel-topline">
            <span>
              <MapPin size={14} /> Danville, Kentucky
            </span>
            <span>
              <ShieldCheck size={14} /> Verified professionals
            </span>
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
                <BarberCard barber={barber} key={barber.id} showSave />
              ))}
            </div>
          )}
        </div>
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
    </main>
  );
}
