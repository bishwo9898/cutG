'use client';

import { barberDiscoveryApi } from '@barber-saas/api-client';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { BarberCard } from '@/components/client-ui';
import { browserApi } from '@/lib/browser-api';
import type { Pagination, PublicBarber } from '@/lib/contracts';

type BarberSearchResponse = { barbers: PublicBarber[]; pagination: Pagination };

export default function HomePage(): React.ReactElement {
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
    router.push(`/barbers?${params.toString()}`);
  };

  return (
    <main className="market-page">
      <header className="market-nav">
        <Link className="brand-lockup dark" href="/">
          <span className="brand-mark">cG</span>
          cutG
        </Link>
        <nav>
          <Link href="/barbers">Find barbers</Link>
          <Link href="/appointments">Appointments</Link>
          <Link href="/login/barber">Barber portal</Link>
          <Link className="button button-primary" href="/login/client">
            Client sign in
          </Link>
        </nav>
      </header>

      <section className="market-hero">
        <div>
          <p className="eyebrow">Client booking</p>
          <h1>Find your next barber and book cleanly.</h1>
          <p>Search trusted barbers, compare services, choose an open slot, and pay at the shop.</p>
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
        </div>
      </section>

      <section className="market-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Featured</p>
            <h2>Top barbers near the marketplace</h2>
          </div>
          <Link className="text-link" href="/barbers">
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
