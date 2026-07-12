'use client';

import { clientApi } from '@barber-saas/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Home, MapPin, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Notice } from '@/components/notice';
import { browserApi } from '@/lib/browser-api';
import type { ClientAddress } from '@/lib/contracts';
import { errorMessage } from '@/lib/errors';

type AddressList = { addresses: ClientAddress[] };
const emptyForm = { label: '', addressLine1: '', city: '', state: '', zipCode: '' };

export default function ClientAddressesPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
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

  return (
    <main className="market-page narrow-page">
      <header className="market-nav">
        <Link className="brand-lockup dark" href="/client">
          <span className="brand-mark">cG</span>cutG
        </Link>
        <nav>
          <Link href="/client/profile">Profile</Link>
        </nav>
      </header>
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
              {(['label', 'addressLine1', 'city', 'state', 'zipCode'] as const).map((key) => (
                <div className="field" key={key}>
                  <label htmlFor={key}>
                    {key === 'addressLine1'
                      ? 'Street address'
                      : key === 'zipCode'
                        ? 'ZIP code'
                        : key[0]?.toUpperCase() + key.slice(1)}
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
