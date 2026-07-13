'use client';

import { clientApi } from '@barber-saas/api-client';
import { Autocomplete, LoadScript, type Libraries } from '@react-google-maps/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Home, LocateFixed, MapPin, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { ClientHeader } from '@/components/client-header';
import { Notice } from '@/components/notice';
import { browserApi } from '@/lib/browser-api';
import type { ClientAddress } from '@/lib/contracts';
import { errorMessage } from '@/lib/errors';
import { placeToResolvedAddress, reverseGeocodeCoordinates } from '@/lib/google-address';

type AddressList = { addresses: ClientAddress[] };
const emptyForm = { label: '', addressLine1: '', city: '', state: '', zipCode: '' };
const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const mapsLibraries: Libraries = ['places'];

export default function ClientAddressesPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const autocomplete = useRef<google.maps.places.Autocomplete | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapsLoadError, setMapsLoadError] = useState(false);
  const addresses = useQuery({
    queryKey: ['client-addresses'],
    queryFn: () => clientApi.addresses<AddressList>(browserApi),
  });
  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['client-addresses'] });
  };
  const create = useMutation({
    mutationFn: () => clientApi.createAddress<ClientAddress>(browserApi, form),
    onSuccess: async () => {
      setForm(emptyForm);
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => clientApi.deleteAddress(browserApi, id),
    onSuccess: refresh,
  });
  const setDefault = useMutation({
    mutationFn: (id: string) => clientApi.setDefaultAddress(browserApi, id),
    onSuccess: refresh,
  });
  const update = (key: keyof typeof form, value: string): void =>
    setForm((current) => ({ ...current, [key]: value }));
  const canSubmit = Object.values(form).every((value) => value.trim().length > 0);
  const choosePlace = (): void => {
    const place = autocomplete.current?.getPlace();
    if (place === undefined) return;

    const resolved = placeToResolvedAddress(place);
    if (resolved === null) {
      setLocationError('Choose a full street address from the suggestions.');
      return;
    }

    setForm((current) => ({
      ...current,
      addressLine1: resolved.addressLine1,
      city: resolved.city,
      state: resolved.state,
      zipCode: resolved.zipCode,
    }));
    setLocationError(null);
  };

  const useCurrentLocation = (): void => {
    setLocationError(null);
    if (!('geolocation' in navigator)) {
      setLocationError('Location access is not available in this browser.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        void (async (): Promise<void> => {
          const resolved = await reverseGeocodeCoordinates(coords.latitude, coords.longitude);

          if (resolved === null) {
            setLocationError('Your location was found, but the address could not be resolved.');
            return;
          }

          setForm((current) => ({
            ...current,
            addressLine1: resolved.addressLine1,
            city: resolved.city,
            state: resolved.state,
            zipCode: resolved.zipCode,
          }));
        })();
      },
      (geolocationError) => {
        setLocating(false);
        setLocationError(
          geolocationError.code === geolocationError.PERMISSION_DENIED
            ? 'Allow location access in your browser to autofill your address.'
            : 'Your current location could not be determined.',
        );
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  return (
    <main className="market-page narrow-page">
      <ClientHeader />
      <section className="market-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Mobile appointments</p>
            <h1>Saved addresses</h1>
          </div>
        </div>
        <div className="address-management-grid">
          <div className="list-stack">
            {(addresses.data?.addresses ?? []).map((address) => (
              <article className="address-management-row" key={address.id}>
                <span className="address-option-icon">
                  {address.isDefault ? <Home size={18} /> : <MapPin size={18} />}
                </span>
                <div>
                  <div className="card-title-row">
                    <strong>{address.label}</strong>
                    {address.isDefault && <span className="mobile-badge">Default</span>}
                  </div>
                  <p>{address.addressLine1}</p>
                  <small>
                    {address.city}, {address.state} {address.zipCode}
                  </small>
                </div>
                <div className="address-row-actions">
                  {!address.isDefault && (
                    <button
                      className="button button-ghost"
                      onClick={() => setDefault.mutate(address.id)}
                      type="button"
                    >
                      Set default
                    </button>
                  )}
                  <button
                    aria-label={`Delete ${address.label}`}
                    className="icon-button"
                    onClick={() => remove.mutate(address.id)}
                    type="button"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          <section className="panel">
            <div className="panel-header">
              <h2>Add an address</h2>
              <Plus size={18} />
            </div>
            <div className="panel-body form-stack">
              <div className="field">
                <label htmlFor="label">Label</label>
                <input
                  className="input"
                  id="label"
                  value={form.label}
                  onChange={(event) => update('label', event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="addressLine1">Street address</label>
                {mapsKey.length === 0 ? (
                  <input
                    className="input"
                    id="addressLine1"
                    value={form.addressLine1}
                    onChange={(event) => update('addressLine1', event.target.value)}
                  />
                ) : (
                  <LoadScript
                    googleMapsApiKey={mapsKey}
                    libraries={mapsLibraries}
                    onError={() => setMapsLoadError(true)}
                    onLoad={() => setMapsLoadError(false)}
                  >
                    <div className="booking-address-tools">
                      <Autocomplete
                        onLoad={(instance) => {
                          autocomplete.current = instance;
                        }}
                        onPlaceChanged={choosePlace}
                        options={{
                          componentRestrictions: { country: 'us' },
                          fields: ['address_components', 'formatted_address', 'geometry', 'name'],
                          types: ['address'],
                        }}
                      >
                        <div className="input-with-icon">
                          <MapPin size={17} />
                          <input
                            id="addressLine1"
                            autoComplete="off"
                            placeholder="Search for an address"
                            value={form.addressLine1}
                            onChange={(event) => update('addressLine1', event.target.value)}
                          />
                        </div>
                      </Autocomplete>
                      <button
                        className="button button-secondary"
                        disabled={locating}
                        onClick={useCurrentLocation}
                        type="button"
                      >
                        <LocateFixed size={16} />
                        {locating ? 'Locating...' : 'Use my location'}
                      </button>
                    </div>
                  </LoadScript>
                )}
                <p className="field-help">
                  Search or use your current location to fill the address.
                </p>
              </div>
              {mapsLoadError && (
                <Notice>
                  Google Maps could not load. Check the web key restrictions for
                  `http://localhost:3000/*`.
                </Notice>
              )}
              {locationError !== null && <Notice>{locationError}</Notice>}
              {(['city', 'state', 'zipCode'] as const).map((key) => (
                <div className="field" key={key}>
                  <label htmlFor={key}>
                    {key === 'zipCode' ? 'ZIP code' : key[0]?.toUpperCase() + key.slice(1)}
                  </label>
                  <input
                    className="input"
                    id={key}
                    value={form[key]}
                    onChange={(event) => update(key, event.target.value)}
                  />
                </div>
              ))}
              <button
                className="button button-primary"
                disabled={!canSubmit || create.isPending}
                onClick={() => create.mutate()}
                type="button"
              >
                {create.isPending ? 'Saving...' : 'Save address'}
              </button>
              {create.isError && <Notice>{errorMessage(create.error)}</Notice>}
              {remove.isError && <Notice>{errorMessage(remove.error)}</Notice>}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
