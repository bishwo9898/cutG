'use client';

import { barberDiscoveryApi } from '@barber-saas/api-client';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { BarberCard } from '@/components/client-ui';
import { browserApi } from '@/lib/browser-api';
import type { Pagination, PublicBarber } from '@/lib/contracts';

type Response = { barbers: PublicBarber[]; pagination: Pagination };

function BarberSearchPageContent(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [city, setCity] = useState(searchParams.get('city') ?? '');
  const [category, setCategory] = useState(searchParams.get('category') ?? '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') ?? '');

  const params = Object.fromEntries(searchParams.entries());
  const { data, isLoading } = useQuery({
    queryKey: ['barber-search', params],
    queryFn: () => barberDiscoveryApi.search<Response>(browserApi, params),
  });

  const applyFilters = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const next = new URLSearchParams();
    if (q.trim()) next.set('q', q.trim());
    if (city.trim()) next.set('city', city.trim());
    if (category) next.set('category', category);
    if (maxPrice.trim()) next.set('maxPrice', maxPrice.trim());
    router.push(`/barbers?${next.toString()}`);
  };

  return (
    <main className="market-page">
      <header className="market-nav">
        <Link className="brand-lockup dark" href="/">
          <span className="brand-mark">cG</span>
          cutG
        </Link>
        <nav>
          <Link href="/appointments">Appointments</Link>
          <Link href="/saved">Saved</Link>
        </nav>
      </header>
      <section className="market-shell">
        <aside className="filter-panel">
          <h2>Search</h2>
          <form className="form-stack" onSubmit={applyFilters}>
            <div className="field">
              <label htmlFor="q">Name or style</label>
              <div className="input-with-icon">
                <Search size={16} />
                <input id="q" value={q} onChange={(event) => setQ(event.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="city">City</label>
              <input
                id="city"
                className="input"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                className="select"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="">Any</option>
                <option value="haircut">Haircut</option>
                <option value="beard">Beard</option>
                <option value="shave">Shave</option>
                <option value="combo">Combo</option>
                <option value="kids">Kids</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="maxPrice">Max price</label>
              <input
                id="maxPrice"
                className="input"
                inputMode="decimal"
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
              />
            </div>
            <button className="button button-primary" type="submit">
              Apply filters
            </button>
          </form>
        </aside>
        <section className="results-panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Marketplace</p>
              <h1>Available barbers</h1>
            </div>
            <p className="muted">{data?.pagination.total ?? 0} results</p>
          </div>
          {isLoading ? (
            <p className="muted">Loading barbers...</p>
          ) : (
            <div className="barber-grid">
              {(data?.barbers ?? []).map((barber) => (
                <BarberCard barber={barber} key={barber.id} showSave />
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

export default function BarberSearchPage(): React.ReactElement {
  return (
    <Suspense fallback={<div className="loading">Loading...</div>}>
      <BarberSearchPageContent />
    </Suspense>
  );
}
