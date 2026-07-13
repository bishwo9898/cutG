'use client';

import { barberDiscoveryApi } from '@barber-saas/api-client';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
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
          <p className="eyebrow">Client booking</p>
          <h1>Find your next barber and book cleanly.</h1>
          <p>Compare services, choose an open slot, or bring a mobile barber to your door.</p>
          <form className="hero-search" onSubmit={submit}>
            <Search size={18} />
            <input
              aria-label="Search by barber, city, or style"
              placeholder="Search by barber, city, or style"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className="button button-primary" type="submit">
              Search
            </button>
          </form>
          <div className="button-row market-hero-actions">
            <Link className="button button-secondary" href="/client/barbers?city=Danville&state=KY">
              Browse Danville
            </Link>
            <Link
              className="button button-secondary"
              href="/client/barbers?city=Danville&state=KY&mobileOnly=true&verified=true"
            >
              Mobile visits near me
            </Link>
          </div>
        </div>
      </section>

      <section className="market-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Featured</p>
            <h2>Top barbers in the marketplace</h2>
          </div>
          <Link className="text-link" href="/client/barbers">
            View all
          </Link>
        </div>
        <div className="barber-grid">
          {(featured.data?.barbers ?? []).map((barber) => (
            <BarberCard barber={barber} key={barber.id} />
          ))}
        </div>
      </section>
    </main>
  );
}
