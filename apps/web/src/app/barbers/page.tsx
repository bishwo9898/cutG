'use client';

import { barberDiscoveryApi } from '@barber-saas/api-client';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Search, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { ClientHeader } from '@/components/client-header';
import { BarberCard } from '@/components/client-ui';
import { browserApi } from '@/lib/browser-api';
import type { Pagination, PublicBarber } from '@/lib/contracts';

type Response = { barbers: PublicBarber[]; pagination: Pagination };

function BarberSearchPageContent(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [city, setCity] = useState(searchParams.get('city') ?? '');
  const [state, setState] = useState(searchParams.get('state') ?? '');
  const [category, setCategory] = useState(searchParams.get('category') ?? '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') ?? '');
  const [mobileOnly, setMobileOnly] = useState(searchParams.get('mobileOnly') === 'true');
  const [verifiedOnly, setVerifiedOnly] = useState(searchParams.get('verified') === 'true');

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
    if (state.trim()) next.set('state', state.trim());
    if (category) next.set('category', category);
    if (maxPrice.trim()) next.set('maxPrice', maxPrice.trim());
    if (mobileOnly) next.set('mobileOnly', 'true');
    if (verifiedOnly) next.set('verified', 'true');
    router.push(`/client/barbers?${next.toString()}`);
  };

  const applyPreset = (updates: Record<string, string | null>): void => {
    const next = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value.length === 0) next.delete(key);
      else next.set(key, value);
    }

    router.push(`/client/barbers?${next.toString()}`);
  };

  return (
    <main className="market-page">
      <ClientHeader />
      <section className="market-shell">
        <aside className="filter-panel">
          <h2>Search</h2>
          <div className="list-stack filter-preset-list">
            <button
              className="list-row selectable"
              onClick={() =>
                applyPreset({ city: 'Danville', state: 'KY', mobileOnly: 'true', verified: 'true' })
              }
              type="button"
            >
              <span>
                <strong>Danville mobile</strong>
                <span className="muted">Best local test path</span>
              </span>
              <MapPin size={16} />
            </button>
            <button
              className="list-row selectable"
              onClick={() => applyPreset({ mobileOnly: 'true' })}
              type="button"
            >
              <span>
                <strong>Mobile only</strong>
                <span className="muted">Only barbers who travel</span>
              </span>
              <ShieldCheck size={16} />
            </button>
          </div>
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
              <label htmlFor="state">State</label>
              <input
                id="state"
                className="input"
                maxLength={2}
                value={state}
                onChange={(event) => setState(event.target.value.toUpperCase())}
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
            <label className="checkbox-row">
              <input
                checked={mobileOnly}
                onChange={(event) => setMobileOnly(event.target.checked)}
                type="checkbox"
              />
              Mobile service only
            </label>
            <label className="checkbox-row">
              <input
                checked={verifiedOnly}
                onChange={(event) => setVerifiedOnly(event.target.checked)}
                type="checkbox"
              />
              Verified barbers only
            </label>
            <button className="button button-primary" type="submit">
              Apply filters
            </button>
          </form>
        </aside>
        <section className="results-panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Marketplace</p>
              <h1>
                {city.trim().length > 0
                  ? `Available barbers in ${city}${state.trim().length > 0 ? `, ${state}` : ''}`
                  : 'Available barbers'}
              </h1>
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
