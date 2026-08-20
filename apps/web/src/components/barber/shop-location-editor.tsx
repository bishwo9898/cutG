'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Crosshair, LoaderCircle, LocateFixed, MapPin, Search, Store } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ServiceAreaMap } from '@/components/client/service-area-map';
import { browserApi } from '@/lib/browser-api';
import { errorMessage } from '@/lib/errors';

const DEFAULT_SHOP_POINT = { latitude: 37.6456, longitude: -84.7722 };

export type ShopLocationValue = {
  placeId?: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  source?: 'google_places' | 'google_geocoding' | 'saved' | 'pin';
};

type LocationSuggestion = {
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
  source: 'google_places' | 'google_geocoding' | 'saved';
};

type SearchResponse = {
  suggestions: LocationSuggestion[];
  source: 'google_places' | 'google_geocoding' | 'saved' | 'unavailable';
};

type ReverseGeocodeResponse = {
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  source?: 'google' | 'coordinate_fallback';
  isApproximateAddress?: boolean;
};

type AddressDetails = Pick<ShopLocationValue, 'address' | 'city' | 'state' | 'zipCode'>;

type ShopLocationEditorProps = {
  businessName?: string;
  idPrefix: string;
  onChange: (location: ShopLocationValue) => void;
  value: ShopLocationValue | null;
};

const detailsFor = (value: ShopLocationValue | null): AddressDetails => ({
  address: value?.address ?? '',
  city: value?.city ?? '',
  state: value?.state ?? '',
  zipCode: value?.zipCode ?? '',
});

const asShopLocation = (suggestion: LocationSuggestion): ShopLocationValue => ({
  ...(suggestion.placeId === undefined ? {} : { placeId: suggestion.placeId }),
  name: suggestion.name,
  address: suggestion.addressLine1,
  city: suggestion.city,
  state: suggestion.state,
  zipCode: suggestion.zipCode,
  country: suggestion.country,
  latitude: suggestion.latitude,
  longitude: suggestion.longitude,
  formattedAddress: suggestion.formattedAddress,
  source: suggestion.source,
});

const formattedDetails = (details: AddressDetails): string =>
  [details.address, details.city, details.state, details.zipCode]
    .filter((part) => part.trim().length > 0)
    .join(', ');

export function ShopLocationEditor({
  businessName = 'My shop',
  idPrefix,
  onChange,
  value,
}: ShopLocationEditorProps): React.ReactElement {
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<ShopLocationValue | null>(value);
  const [details, setDetails] = useState<AddressDetails>(() => detailsFor(value));
  const [pin, setPin] = useState(() =>
    value === null ? DEFAULT_SHOP_POINT : { latitude: value.latitude, longitude: value.longitude },
  );
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const selectedRef = useRef(selected);
  const autoLocatedRef = useRef(false);

  useEffect(() => {
    selectedRef.current = value;
    setSelected(value);
    setDetails(detailsFor(value));
    if (value !== null) {
      setPin({ latitude: value.latitude, longitude: value.longitude });
    }
  }, [value]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(searchText.trim()), 380);
    return (): void => window.clearTimeout(timeout);
  }, [searchText]);

  const commit = (next: ShopLocationValue): void => {
    selectedRef.current = next;
    setSelected(next);
    setPin({ latitude: next.latitude, longitude: next.longitude });
    setDetails(detailsFor(next));
    onChange(next);
  };

  const locationSearch = useQuery({
    queryKey: [
      'shop-location-search',
      debouncedSearch,
      selected?.latitude ?? null,
      selected?.longitude ?? null,
    ],
    queryFn: () =>
      browserApi.post<SearchResponse>('/barbers/me/shop-location/search', {
        query: debouncedSearch,
        ...(selected === null
          ? {}
          : { latitude: selected.latitude, longitude: selected.longitude }),
      }),
    enabled: debouncedSearch.length >= 3,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const reverseGeocode = useMutation({
    mutationFn: (point: { latitude: number; longitude: number }) =>
      browserApi.post<ReverseGeocodeResponse>('/barbers/me/shop-location/reverse-geocode', point),
    onSuccess: (resolved, point) => {
      const previous = selectedRef.current;
      const approximate = resolved.isApproximateAddress === true;
      commit({
        name: previous?.name ?? businessName,
        address:
          approximate && details.address.trim().length > 0
            ? details.address
            : resolved.addressLine1,
        city: approximate && details.city.trim().length > 0 ? details.city : resolved.city,
        state: approximate && details.state.trim().length > 0 ? details.state : resolved.state,
        zipCode:
          approximate && details.zipCode.trim().length > 0 ? details.zipCode : resolved.zipCode,
        country: resolved.country,
        latitude: point.latitude,
        longitude: point.longitude,
        formattedAddress:
          approximate && formattedDetails(details).length > 0
            ? formattedDetails(details)
            : resolved.formattedAddress,
        source: 'pin',
      });
    },
  });

  const suggestions = locationSearch.data?.suggestions ?? [];
  const preview = suggestions[0] ?? null;
  const mapPoint = useMemo(
    () => (preview === null ? pin : { latitude: preview.latitude, longitude: preview.longitude }),
    [pin, preview],
  );

  const chooseSuggestion = (suggestion: LocationSuggestion): void => {
    commit(asShopLocation(suggestion));
    setLocationMessage(null);
    setSearchText('');
    setDebouncedSearch('');
  };

  const commitPinnedPoint = (point: { latitude: number; longitude: number }): void => {
    const current = selectedRef.current;
    commit({
      name: current?.name ?? businessName,
      address: current?.address ?? (details.address || 'Pinned shop location'),
      city: current?.city ?? details.city,
      state: current?.state ?? details.state,
      zipCode: current?.zipCode ?? details.zipCode,
      country: current?.country ?? 'US',
      latitude: point.latitude,
      longitude: point.longitude,
      formattedAddress:
        current?.formattedAddress ?? (formattedDetails(details) || 'Pinned shop location'),
      source: 'pin',
    });
  };

  const choosePrecisePoint = (point: { latitude: number; longitude: number }): void => {
    setSearchText('');
    setDebouncedSearch('');
    setPin(point);
    commitPinnedPoint(point);
    reverseGeocode.mutate(point);
  };

  const locatePrecisely = (): void => {
    if (!('geolocation' in navigator)) {
      setLocationMessage(
        'This browser cannot provide a device location. Use search or place the pin manually.',
      );
      return;
    }
    setLocating(true);
    setLocationMessage('Getting a fresh, high-accuracy position…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setLocating(false);
        setLocationMessage(
          position.coords.accuracy > 50
            ? `Location found within about ${Math.round(position.coords.accuracy)} metres. Fine-tune the pin if needed.`
            : `Precise location found within about ${Math.max(1, Math.round(position.coords.accuracy))} metres.`,
        );
        choosePrecisePoint(point);
      },
      (error) => {
        setLocating(false);
        setLocationMessage(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission is off. Allow precise location in your browser settings, or search and place the pin manually.'
            : 'Your current location could not be read. Search for the address or place the pin manually.',
        );
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
  };

  useEffect(() => {
    if (autoLocatedRef.current || value !== null || navigator.permissions === undefined) return;
    autoLocatedRef.current = true;
    void navigator.permissions
      .query({ name: 'geolocation' })
      .then((permission) => {
        if (permission.state === 'granted') locatePrecisely();
      })
      .catch(() => undefined);
  }, [value]);

  const useTypedAddress = (): void => {
    const manualAddress = searchText.trim();
    if (manualAddress.length === 0) return;
    const nextDetails = { ...details, address: manualAddress };
    setDetails(nextDetails);
    commit({
      name: selectedRef.current?.name ?? businessName,
      address: manualAddress,
      city: nextDetails.city,
      state: nextDetails.state,
      zipCode: nextDetails.zipCode,
      country: selectedRef.current?.country ?? 'US',
      latitude: pin.latitude,
      longitude: pin.longitude,
      formattedAddress: formattedDetails(nextDetails),
      source: 'pin',
    });
    setSearchText('');
    setDebouncedSearch('');
    setLocationMessage(
      'Manual address selected. Complete the city, state, and ZIP, then confirm the exact map pin.',
    );
  };

  const updateDetail = (key: keyof AddressDetails, nextValue: string): void => {
    const nextDetails = { ...details, [key]: nextValue };
    setDetails(nextDetails);
    const current = selectedRef.current;
    if (current === null) return;
    const next = {
      ...current,
      ...nextDetails,
      formattedAddress: formattedDetails(nextDetails),
    };
    selectedRef.current = next;
    setSelected(next);
    onChange(next);
  };

  const useCurrentPin = (): void => {
    if (selectedRef.current !== null) {
      reverseGeocode.mutate(pin);
      return;
    }
    commit({
      name: businessName,
      address: details.address || 'Pinned shop location',
      city: details.city,
      state: details.state,
      zipCode: details.zipCode,
      country: 'US',
      latitude: pin.latitude,
      longitude: pin.longitude,
      formattedAddress: formattedDetails(details) || 'Pinned shop location',
      source: 'pin',
    });
  };

  return (
    <section className="panel shop-location-editor">
      <div className="panel-header service-panel-header">
        <div>
          <span className="eyebrow">Client-facing location</span>
          <h2>Shop address</h2>
          <p className="panel-description">
            Search by shop name or street address, then confirm the exact entrance.
          </p>
        </div>
        {selected !== null && (
          <span className="shop-location-status">
            <Check size={14} /> Ready to save
          </span>
        )}
      </div>

      <div className="panel-body shop-location-body">
        <div className="shop-location-search">
          <div className="input-with-icon shop-search-input">
            {locationSearch.isFetching ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Search size={18} />
            )}
            <input
              aria-autocomplete="list"
              aria-controls={`${idPrefix}-results`}
              aria-expanded={suggestions.length > 0}
              autoComplete="off"
              id={`${idPrefix}-search`}
              placeholder="Shop name or full street address"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>

          {debouncedSearch.length >= 3 && (
            <div className="shop-location-results" id={`${idPrefix}-results`} role="listbox">
              {locationSearch.isFetching && (
                <div className="shop-search-message">
                  <LoaderCircle className="spin" size={16} />
                  Finding the closest map matches…
                </div>
              )}
              {!locationSearch.isFetching &&
                suggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.placeId ?? suggestion.formattedAddress}-${suggestion.latitude}`}
                    onClick={() => chooseSuggestion(suggestion)}
                    role="option"
                    type="button"
                  >
                    <span className="shop-result-icon">
                      {suggestion.source === 'saved' ? <MapPin size={17} /> : <Store size={17} />}
                    </span>
                    <span>
                      <strong>{suggestion.name}</strong>
                      <small>{suggestion.formattedAddress}</small>
                    </span>
                    <em>{suggestion.source === 'saved' ? 'Saved address' : 'Choose'}</em>
                  </button>
                ))}
              {!locationSearch.isFetching && (
                <button
                  className="shop-manual-result"
                  onClick={useTypedAddress}
                  role="option"
                  type="button"
                >
                  <span className="shop-result-icon">
                    <MapPin size={17} />
                  </span>
                  <span>
                    <strong>Use “{searchText.trim()}” as typed</strong>
                    <small>Enter any missing details and confirm the exact pin yourself.</small>
                  </span>
                  <em>Manual</em>
                </button>
              )}
              {!locationSearch.isFetching &&
                locationSearch.isSuccess &&
                suggestions.length === 0 && (
                  <div className="shop-search-message">
                    <MapPin size={16} />
                    No map match yet. Move the pin and complete the address details below.
                  </div>
                )}
              {locationSearch.isError && (
                <div className="shop-search-message shop-search-error">
                  <MapPin size={16} />
                  {errorMessage(locationSearch.error)} You can still position the pin manually.
                </div>
              )}
              {(locationSearch.data?.source === 'google_places' ||
                locationSearch.data?.source === 'google_geocoding') && (
                <small className="shop-google-attribution">Matches provided by Google</small>
              )}
            </div>
          )}
        </div>

        <button
          className="button button-secondary shop-precise-location"
          disabled={locating}
          onClick={locatePrecisely}
          type="button"
        >
          {locating ? <LoaderCircle className="spin" size={17} /> : <LocateFixed size={17} />}
          {locating ? 'Finding your precise location…' : 'Use my precise location'}
        </button>
        {locationMessage !== null && (
          <div className="shop-preview-note" role="status">
            <Crosshair size={15} /> {locationMessage}
          </div>
        )}

        {preview !== null && searchText.trim().length >= 3 && (
          <div className="shop-preview-note" role="status">
            <Crosshair size={15} />
            Previewing the closest match. Choose an address to confirm it.
          </div>
        )}

        <div className="shop-location-map-frame">
          <ServiceAreaMap
            center={mapPoint}
            destination={mapPoint}
            markerVariant="store"
            onDestinationChange={(point) => {
              setLocationMessage(null);
              choosePrecisePoint(point);
            }}
            radiusMiles={null}
            zoom={14}
          />
          <span className="shop-map-hint">
            <Crosshair size={14} /> Drag the shop marker or tap the exact entrance
          </span>
        </div>

        {reverseGeocode.isPending && (
          <div className="shop-preview-note" role="status">
            <LoaderCircle className="spin" size={15} />
            Checking the address at this pin…
          </div>
        )}
        {reverseGeocode.isError && (
          <div className="shop-preview-note shop-search-error" role="alert">
            <MapPin size={15} />
            Could not read this pin automatically. Complete the address below and use this pin.
          </div>
        )}

        <div className="shop-address-details">
          <div className="shop-address-heading">
            <div>
              <strong>Address details</strong>
              <small>These are shown to clients after you save.</small>
            </div>
            {selected !== null && (
              <span>
                {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor={`${idPrefix}-address`}>Street or suite address</label>
            <input
              className="input"
              id={`${idPrefix}-address`}
              value={details.address}
              onChange={(event) => updateDetail('address', event.target.value)}
            />
          </div>
          <div className="shop-address-grid">
            <div className="field">
              <label htmlFor={`${idPrefix}-city`}>City</label>
              <input
                className="input"
                id={`${idPrefix}-city`}
                value={details.city}
                onChange={(event) => updateDetail('city', event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor={`${idPrefix}-state`}>State</label>
              <input
                className="input"
                id={`${idPrefix}-state`}
                value={details.state}
                onChange={(event) => updateDetail('state', event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor={`${idPrefix}-zip`}>ZIP code</label>
              <input
                className="input"
                id={`${idPrefix}-zip`}
                value={details.zipCode}
                onChange={(event) => updateDetail('zipCode', event.target.value)}
              />
            </div>
          </div>
          {selected === null && (
            <button
              className="button button-secondary shop-use-pin"
              disabled={details.address.trim().length === 0 || reverseGeocode.isPending}
              onClick={useCurrentPin}
              type="button"
            >
              <MapPin size={16} /> Use this map pin
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
