'use client';

import { barberDiscoveryApi } from '@barber-saas/api-client';
import { useUser as useClerkUser } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Car, MapPin, Search, ShieldCheck, Sparkles, Star } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ClientHeader } from '@/components/client-header';
import { BarberCard } from '@/components/client-ui';
import { browserApi } from '@/lib/browser-api';
import type { Pagination, PublicBarber } from '@/lib/contracts';
import { hasAiStudioAccess } from '@/lib/features';

type BarberSearchResponse = { barbers: PublicBarber[]; pagination: Pagination };

export function ClientHome(): React.ReactElement {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { user: clerkUser } = useClerkUser();
  const aiStudio = hasAiStudioAccess(clerkUser?.publicMetadata);
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

      <section className="market-hero market-home-hero">
        <div className="market-home-hero-inner">
          <div className="market-home-hero-copy">
            <p className="eyebrow">Danville's barber marketplace</p>
            <h1>Find your mobile barber.</h1>
            <p>Search trusted local barbers and book at the shop or at your door.</p>
          </div>
          <div className="market-home-search-panel">
            <form className="hero-search" onSubmit={submit}>
              <Search size={18} />
              <input
                aria-label="Search by barber, city, or style"
                placeholder="Barber, city, or style"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button className="button button-primary" type="submit">
                Search <span aria-hidden="true">→</span>
              </button>
            </form>
            <div className="quick-filter-row" aria-label="Popular barber filters">
              <Link href="/client/barbers?city=Danville&state=KY">
                <MapPin size={15} /> Near me
              </Link>
              <Link href="/client/barbers?city=Danville&state=KY&mobileOnly=true">
                <Car size={15} /> Mobile
              </Link>
              <Link href="/client/barbers?minRating=4">
                <Star size={15} /> Top rated
              </Link>
              <Link href="/client/barbers?category=haircut">
                <Sparkles size={15} /> Fades
              </Link>
            </div>
          </div>
        </div>
      </section>

      {aiStudio && (
        <section className="market-section design-home-band design-home-band-featured">
          <div className="design-home-copy">
            <p className="eyebrow">AI Hair Design Studio</p>
            <h2>Preview your next cut.</h2>
            <p>Upload a photo, choose a style, and compare a realistic preview before you book.</p>
            <div className="design-home-proof">
              <span>
                <ShieldCheck size={15} /> Private gallery
              </span>
              <span>
                <Sparkles size={15} /> Original vs. preview
              </span>
            </div>
            <Link className="button button-primary" href="/client/design">
              Try AI Design <ArrowUpRight size={16} />
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
      )}

      <section className="market-section nearby-barbers-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Near you</p>
            <h2>Trusted barbers, ready when you are.</h2>
            <p className="nearby-barbers-intro">
              Verified profiles, clear pricing, and real availability.
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
            <div className="barber-grid nearby-barbers-gallery">
              {Array.from({ length: 3 }, (_, index) => (
                <div className="market-card skeleton-card" key={index} />
              ))}
            </div>
          ) : (
            <div className="barber-grid nearby-barbers-gallery">
              {(featured.data?.barbers ?? []).slice(0, 3).map((barber) => (
                <BarberCard barber={barber} compact key={barber.id} showSave />
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
    </main>
  );
}
