'use client';

import { barberDiscoveryApi, clientApi } from '@barber-saas/api-client';
import { useQuery } from '@tanstack/react-query';
import { Check, LocateFixed, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { ClientHeader } from '@/components/client-header';
import { BarberCard } from '@/components/client-ui';
import { Notice } from '@/components/notice';
import { browserApi } from '@/lib/browser-api';
import type { ClientAddress, HairDesign, Pagination, PublicBarber } from '@/lib/contracts';

type Suggestion = {
  placeId?: string;
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
};
type LocationSearchResponse = { suggestions: Suggestion[] };
type MarketplaceResult = {
  id: string;
  businessName: string;
  bio: string | null;
  profilePhotoUrl: string | null;
  city: string | null;
  state: string | null;
  averageRating: number;
  totalReviews: number;
  lowestMatchingPrice: number | null;
  serviceCategories: string[];
  nextAvailableSlot: string | null;
  distanceMiles: number | null;
  capabilities: { mobileVisits: boolean; onlinePayments: boolean; verified: boolean };
};
type Response = { barbers: MarketplaceResult[]; pagination: Pagination };
type Point = { label: string; latitude: number; longitude: number };

const categoryOptions = [
  ['', 'Any category'],
  ['haircut', 'Haircut'],
  ['beard', 'Beard'],
  ['shave', 'Shave'],
  ['color', 'Color'],
  ['combo', 'Cut & beard'],
  ['kids', 'Kids'],
  ['other', 'Other'],
] as const;

const toCardBarber = (barber: MarketplaceResult): PublicBarber => ({
  id: barber.id,
  businessName: barber.businessName,
  bio: barber.bio,
  profilePhotoUrl: barber.profilePhotoUrl,
  city: barber.city,
  state: barber.state,
  averageRating: barber.averageRating,
  totalReviews: barber.totalReviews,
  isVerified: barber.capabilities.verified,
  subscriptionTier: 'FREE',
  lowestServicePrice: barber.lowestMatchingPrice,
  serviceCategories: barber.serviceCategories,
  nextAvailableSlot: barber.nextAvailableSlot,
  onlinePaymentsAvailable: barber.capabilities.onlinePayments,
  distanceMiles: barber.distanceMiles,
  mobileService: barber.capabilities.mobileVisits
    ? {
        isEnabled: true,
        serviceRadiusMiles: 50,
        travelFeeStructure: 'free',
        baseFee: 0,
        perMileRate: null,
        notes: null,
      }
    : null,
});

function BarberSearchPageContent(): React.ReactElement {
  const searchParams = useSearchParams();
  const designId = searchParams.get('designId');
  const [locationText, setLocationText] = useState('');
  const [location, setLocation] = useState<Point | null>(null);
  const [category, setCategory] = useState('');
  const [distance, setDistance] = useState(50);
  const [maxPrice, setMaxPrice] = useState(200);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const addresses = useQuery({
    queryKey: ['client-addresses'],
    queryFn: () => clientApi.addresses<{ addresses: ClientAddress[] }>(browserApi),
  });
  const design = useQuery({
    queryKey: ['hair-design', designId],
    queryFn: () => clientApi.design<HairDesign>(browserApi, designId as string),
    enabled: designId !== null,
  });
  const suggestions = useQuery({
    queryKey: ['market-location-suggestions', locationText, location?.label],
    queryFn: () =>
      clientApi.searchLocations<LocationSearchResponse>(browserApi, {
        query: locationText,
        ...(location === null
          ? {}
          : { latitude: location.latitude, longitude: location.longitude }),
      }),
    enabled: locationText.trim().length >= 3 && locationText !== location?.label,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (location !== null || addresses.data === undefined) return;
    const saved = addresses.data.addresses.find((address) => address.isDefault);
    if (saved === undefined) return;
    const label = `${saved.addressLine1}, ${saved.city}, ${saved.state}`;
    setLocation({ label, latitude: saved.latitude, longitude: saved.longitude });
    setLocationText(label);
  }, [addresses.data, location]);

  const request = useMemo(
    () => ({
      ...(location === null ? {} : { location }),
      ...(category === '' ? {} : { category }),
      ...(distance >= 50 || location === null ? {} : { maxDistanceMiles: distance }),
      ...(maxPrice >= 200 ? {} : { maxPrice }),
      page: 1,
      limit: 48,
    }),
    [category, distance, location, maxPrice],
  );
  const results = useQuery({
    queryKey: ['marketplace-search', request],
    queryFn: () => barberDiscoveryApi.marketplaceSearch<Response>(browserApi, request),
  });

  const chooseLocation = (suggestion: Suggestion): void => {
    const point = {
      label: suggestion.formattedAddress,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    };
    setLocation(point);
    setLocationText(point.label);
    setLocationError(null);
  };

  const useCurrentLocation = (): void => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('Current location is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          label: 'Current location',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setLocation(point);
        setLocationText(point.label);
        setLocating(false);
      },
      () => {
        setLocationError('Location permission was not granted. Type an address instead.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const activeFilters = [
    location === null ? null : { key: 'location', label: location.label },
    category === ''
      ? null
      : { key: 'category', label: categoryOptions.find(([value]) => value === category)?.[1] },
    distance >= 50 || location === null
      ? null
      : { key: 'distance', label: `Within ${distance} miles` },
    maxPrice >= 200 ? null : { key: 'price', label: `Up to $${maxPrice}` },
  ].filter((item): item is { key: string; label: string } => item?.label !== undefined);

  const clearFilter = (key: string): void => {
    if (key === 'location') {
      setLocation(null);
      setLocationText('');
    }
    if (key === 'category') setCategory('');
    if (key === 'distance') setDistance(50);
    if (key === 'price') setMaxPrice(200);
  };

  return (
    <main className="market-page marketplace-discovery-page">
      <ClientHeader />
      <section className="marketplace-discovery-shell">
        <header className="marketplace-heading">
          <p className="eyebrow">Find your barber</p>
          <h1>Great cuts, close to you.</h1>
          <p>Choose a location, then narrow the list only when you need to.</p>
        </header>

        <section className="location-search-panel" aria-label="Search location">
          <div className="location-autocomplete">
            <MapPin size={20} />
            <input
              aria-label="Address or location"
              autoComplete="street-address"
              onChange={(event) => {
                setLocationText(event.target.value);
                if (event.target.value !== location?.label) setLocation(null);
              }}
              placeholder="Enter an address, neighborhood, city, or ZIP"
              value={locationText}
            />
            {locationText.length > 0 && (
              <button
                aria-label="Clear location"
                onClick={() => clearFilter('location')}
                type="button"
              >
                <X size={17} />
              </button>
            )}
            {suggestions.data !== undefined && suggestions.data.suggestions.length > 0 && (
              <div className="location-suggestion-menu" role="listbox">
                {suggestions.data.suggestions.map((suggestion) => (
                  <button
                    key={suggestion.placeId ?? suggestion.formattedAddress}
                    onClick={() => chooseLocation(suggestion)}
                    role="option"
                    type="button"
                  >
                    <MapPin size={16} />
                    <span>
                      <strong>{suggestion.name}</strong>
                      <small>{suggestion.formattedAddress}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="button button-secondary" onClick={useCurrentLocation} type="button">
            <LocateFixed size={17} /> {locating ? 'Locating…' : 'Use my current location'}
          </button>
          <button
            aria-expanded={filtersOpen}
            className="button button-ghost marketplace-filter-trigger"
            onClick={() => setFiltersOpen((open) => !open)}
            type="button"
          >
            <SlidersHorizontal size={17} /> Filters
          </button>
        </section>
        {locationError !== null && <Notice>{locationError}</Notice>}

        <section className={`marketplace-filter-bar${filtersOpen ? ' is-open' : ''}`}>
          <label>
            <span>Category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categoryOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Distance</span>
            <strong>{distance >= 50 ? '50+ miles · Any' : `${distance} miles`}</strong>
            <input
              aria-valuetext={distance >= 50 ? 'Any distance' : `${distance} miles`}
              max="50"
              min="5"
              onChange={(event) => setDistance(Number(event.target.value))}
              step="5"
              type="range"
              value={distance}
            />
          </label>
          <label>
            <span>Maximum price</span>
            <strong>{maxPrice >= 200 ? '$200+ · Any' : `$${maxPrice}`}</strong>
            <input
              aria-valuetext={maxPrice >= 200 ? 'Any maximum price' : `${maxPrice} dollars`}
              max="200"
              min="10"
              onChange={(event) => setMaxPrice(Number(event.target.value))}
              step="10"
              type="range"
              value={maxPrice}
            />
          </label>
        </section>

        {activeFilters.length > 0 && (
          <div className="active-filter-chips" aria-label="Active filters">
            {activeFilters.map((filter) => (
              <button key={filter.key} onClick={() => clearFilter(filter.key)} type="button">
                {filter.key === 'location' && <Check size={14} />}
                {filter.label} <X size={14} />
              </button>
            ))}
          </div>
        )}

        {design.data !== undefined && (
          <Notice>
            Booking for {design.data.styleName}; your barber will receive the private preview.
          </Notice>
        )}

        <div className="marketplace-results-heading">
          <div>
            <h2>{location === null ? 'Barbers ready to book' : `Barbers near ${location.label}`}</h2>
            <p>Closest matches appear first when a location is selected.</p>
          </div>
          <span>{results.data?.pagination.total ?? 0} results</span>
        </div>

        {results.isPending ? (
          <div className="marketplace-card-grid" aria-label="Loading barbers">
            {Array.from({ length: 8 }, (_, index) => (
              <div className="market-card skeleton-card" key={index} />
            ))}
          </div>
        ) : results.isError ? (
          <Notice>We could not load barbers right now. Please try again.</Notice>
        ) : results.data.barbers.length === 0 ? (
          <section className="marketplace-empty-state">
            <Search size={28} />
            <h2>No barbers match those filters yet.</h2>
            <p>Try the broad “Any” setting for distance or price to see more options.</p>
            <button
              className="button button-secondary"
              onClick={() => {
                setCategory('');
                setDistance(50);
                setMaxPrice(200);
              }}
              type="button"
            >
              Broaden search
            </button>
          </section>
        ) : (
          <div className="marketplace-card-grid">
            {results.data.barbers.map((barber) => (
              <BarberCard
                barber={toCardBarber(barber)}
                key={barber.id}
                query={designId === null ? '' : `?designId=${designId}`}
                showSave
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default function BarberSearchPage(): React.ReactElement {
  return (
    <Suspense fallback={<div className="loading">Loading…</div>}>
      <BarberSearchPageContent />
    </Suspense>
  );
}
