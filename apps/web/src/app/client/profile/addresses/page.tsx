'use client';

import { clientApi } from '@barber-saas/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Home, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { ClientHeader } from '@/components/client-header';
import { Notice } from '@/components/notice';
import { PreciseLocationPicker } from '@/components/precise-location-picker';
import { browserApi } from '@/lib/browser-api';
import type { ClientAddress } from '@/lib/contracts';
import { errorMessage } from '@/lib/errors';
import type { ResolvedGoogleAddress } from '@/lib/google-address';

type AddressList = { addresses: ClientAddress[] };
type AddressForm = {
  label: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
};
const emptyForm: AddressForm = {
  label: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  zipCode: '',
};
const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export default function ClientAddressesPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [addressSearch, setAddressSearch] = useState('');
  const [preciseLocation, setPreciseLocation] = useState<ResolvedGoogleAddress | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
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
      setAddressSearch('');
      setPreciseLocation(null);
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => clientApi.deleteAddress(browserApi, id),
    onSuccess: refresh,
  });
  const edit = useMutation({
    mutationFn: () => clientApi.updateAddress<ClientAddress>(browserApi, editingId ?? '', form),
    onSuccess: async () => {
      setForm(emptyForm);
      setAddressSearch('');
      setPreciseLocation(null);
      setEditingId(null);
      await refresh();
    },
  });
  const setDefault = useMutation({
    mutationFn: (id: string) => clientApi.setDefaultAddress(browserApi, id),
    onSuccess: refresh,
  });
  const update = (
    key: 'label' | 'addressLine1' | 'addressLine2' | 'city' | 'state' | 'zipCode',
    value: string,
  ): void => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key !== 'label' && key !== 'addressLine2') {
        delete next.latitude;
        delete next.longitude;
      }
      return next;
    });
    if (key !== 'label' && key !== 'addressLine2') setPreciseLocation(null);
  };
  const canSubmit =
    form.label.trim().length > 0 &&
    form.addressLine1.trim().length > 0 &&
    form.city.trim().length > 0 &&
    form.state.trim().length > 0 &&
    form.zipCode.trim().length > 0;
  const beginEdit = (address: ClientAddress): void => {
    setEditingId(address.id);
    setForm({
      label: address.label,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 ?? '',
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      latitude: address.latitude,
      longitude: address.longitude,
    });
    const formattedAddress = `${address.addressLine1}, ${address.city}, ${address.state} ${address.zipCode}`;
    setAddressSearch(formattedAddress);
    setPreciseLocation({
      addressLine1: address.addressLine1,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      country: address.country,
      latitude: address.latitude,
      longitude: address.longitude,
      formattedAddress,
    });
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const choosePreciseLocation = (resolved: ResolvedGoogleAddress): void => {
    setPreciseLocation(resolved);
    setForm((current) => ({
      ...current,
      addressLine1: resolved.addressLine1,
      addressLine2: resolved.addressLine2 ?? '',
      city: resolved.city,
      state: resolved.state,
      zipCode: resolved.zipCode,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
    }));
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
                  {address.addressLine2 !== null && <small>{address.addressLine2}</small>}
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
                    aria-label={`Edit ${address.label}`}
                    className="icon-button"
                    onClick={() => beginEdit(address)}
                    type="button"
                  >
                    <Pencil size={17} />
                  </button>
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
              <h2>{editingId === null ? 'Add an address' : 'Edit address'}</h2>
              {editingId === null ? (
                <Plus size={18} />
              ) : (
                <button
                  aria-label="Cancel editing"
                  className="icon-button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                    setAddressSearch('');
                    setPreciseLocation(null);
                  }}
                  type="button"
                >
                  <X size={17} />
                </button>
              )}
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
                  <PreciseLocationPicker
                    inputId="addressLine1"
                    onLocationChange={choosePreciseLocation}
                    onSearchValueChange={(value) => {
                      setAddressSearch(value);
                      if (value !== preciseLocation?.formattedAddress) {
                        setPreciseLocation(null);
                        setForm((current) => {
                          const next = { ...current, addressLine1: value };
                          delete next.latitude;
                          delete next.longitude;
                          return next;
                        });
                      }
                    }}
                    searchValue={addressSearch}
                    value={preciseLocation}
                  />
                )}
                <p className="field-help">
                  Search, use your current location, or drag the pin to the exact entrance.
                </p>
              </div>
              <div className="field">
                <label htmlFor="addressLine2">Apartment, suite, or unit</label>
                <input
                  className="input"
                  id="addressLine2"
                  value={form.addressLine2}
                  onChange={(event) => update('addressLine2', event.target.value)}
                  placeholder="Optional"
                />
              </div>
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
                onClick={() => (editingId === null ? create.mutate() : edit.mutate())}
                type="button"
              >
                {create.isPending || edit.isPending
                  ? 'Saving...'
                  : editingId === null
                    ? 'Save address'
                    : 'Update address'}
              </button>
              {create.isError && <Notice>{errorMessage(create.error)}</Notice>}
              {edit.isError && <Notice>{errorMessage(edit.error)}</Notice>}
              {remove.isError && <Notice>{errorMessage(remove.error)}</Notice>}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
