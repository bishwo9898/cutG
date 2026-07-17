'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crosshair, Map, MapPin, Navigation, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ServiceAreaMap } from '@/components/client/service-area-map';
import { Notice } from '@/components/notice';
import { LoadingState } from '@/components/query-states';
import { browserApi } from '@/lib/browser-api';
import { errorMessage } from '@/lib/errors';

type FeeStructure = 'flat' | 'per_mile' | 'free';
type MobileConfig = {
  isEnabled: boolean;
  originSource?: 'profile' | 'custom' | 'default';
  serviceRadiusMiles?: number;
  feeStructure?: FeeStructure;
  baseFeeCents?: number;
  perMileRateCents?: number;
  originLatitude?: number;
  originLongitude?: number;
  originAddress?: string | null;
  mobileServiceNotes?: string | null;
  suggestedFee: { flat: number; perMile: number; rationale: string };
};

export default function MobileServicePage(): React.ReactElement {
  const queryClient = useQueryClient();
  const config = useQuery({
    queryKey: ['mobile-config'],
    queryFn: () => browserApi.get<MobileConfig>('/barbers/me/mobile'),
  });
  const [enabled, setEnabled] = useState(false);
  const [radius, setRadius] = useState(15);
  const [feeStructure, setFeeStructure] = useState<FeeStructure>('flat');
  const [fee, setFee] = useState('15');
  const [latitude, setLatitude] = useState(37.6456);
  const [longitude, setLongitude] = useState(-84.7722);
  const [originAddress, setOriginAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config.data === undefined) return;
    setEnabled(config.data.isEnabled);
    setRadius(config.data.serviceRadiusMiles ?? 15);
    setFeeStructure(config.data.feeStructure ?? 'flat');
    setFee(
      String(
        ((config.data.feeStructure === 'per_mile'
          ? config.data.perMileRateCents
          : config.data.baseFeeCents) ?? config.data.suggestedFee.flat) / 100,
      ),
    );
    setLatitude(config.data.originLatitude ?? 37.6456);
    setLongitude(config.data.originLongitude ?? -84.7722);
    setOriginAddress(config.data.originAddress ?? '');
    setNotes(config.data.mobileServiceNotes ?? '');
  }, [config.data]);

  const setOrigin = (lat: number, lng: number): void => {
    setLatitude(lat);
    setLongitude(lng);
  };

  const mutation = useMutation({
    mutationFn: () =>
      browserApi.put<MobileConfig>('/barbers/me/mobile', {
        isEnabled: enabled,
        serviceRadiusMiles: radius,
        feeStructure,
        baseFeeCents: feeStructure === 'flat' ? Math.round(Number(fee) * 100) : 0,
        perMileRateCents: feeStructure === 'per_mile' ? Math.round(Number(fee) * 100) : 0,
        originLatitude: latitude,
        originLongitude: longitude,
        originAddress: originAddress || undefined,
        mobileServiceNotes: notes || undefined,
      }),
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['mobile-config'] });
    },
  });

  const origin = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);

  if (config.isPending) return <LoadingState />;
  const suggestion = config.data?.suggestedFee;
  const selectedSuggestion = feeStructure === 'per_mile' ? suggestion?.perMile : suggestion?.flat;
  const feeIsValid = feeStructure === 'free' || (Number.isFinite(Number(fee)) && Number(fee) >= 0);
  const originSourceLabel =
    config.data?.originSource === 'custom'
      ? 'Custom mobile origin'
      : config.data?.originSource === 'profile'
        ? 'Using shop profile location'
        : 'Using default Danville area';

  return (
    <main className="page mobile-service-page">
      <div className="page-header mobile-service-heading">
        <div>
          <span className="eyebrow">Business settings</span>
          <h1>Mobile service</h1>
          <p>Control where you travel and how each visit is priced.</p>
        </div>
        <label className="service-toggle">
          <span className="service-toggle-copy">
            <strong>{enabled ? 'Accepting mobile visits' : 'Mobile visits paused'}</strong>
            <small>Your saved settings remain available.</small>
          </span>
          <input
            aria-label="Enable mobile service"
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          <span className="toggle-track" aria-hidden="true" />
        </label>
      </div>

      {mutation.isError && <Notice>{errorMessage(mutation.error)}</Notice>}
      {saved && <Notice tone="success">Mobile service settings saved.</Notice>}

      <div className="mobile-service-layout">
        <section className="panel service-area-panel">
          <div className="panel-header service-panel-header">
            <div>
              <h2>Service area</h2>
              <p className="panel-description">Default area is 15 miles from your shop.</p>
            </div>
            <div className="service-area-badges">
              <span className="origin-source-badge">{originSourceLabel}</span>
              <span className="radius-badge">{radius} mi</span>
            </div>
          </div>
          <div className="panel-body service-area-body">
            <div className="origin-controls">
              <div className="input-with-icon origin-input">
                <MapPin size={18} />
                <input
                  aria-label="Origin address"
                  autoComplete="off"
                  id="originAddress"
                  placeholder="Write the store address manually"
                  value={originAddress}
                  onChange={(event) => {
                    setOriginAddress(event.target.value);
                  }}
                />
              </div>
            </div>
            <div className="map-mode-control map-legend" aria-label="Map view">
              <span className="is-active">
                <Crosshair size={15} /> Exact pin
              </span>
              <span>
                <Map size={15} /> Service area
              </span>
            </div>
            <div className="service-area-map-frame">
              <ServiceAreaMap
                center={origin}
                destination={origin}
                markerVariant={originAddress.trim().length > 0 ? 'store' : 'pin'}
                onDestinationChange={(point) => {
                  setOrigin(point.latitude, point.longitude);
                }}
                radiusMiles={radius}
                zoom={radius <= 5 ? 12 : radius <= 15 ? 10 : 9}
              />
            </div>
            <div className="radius-control">
              <div className="radius-control-copy">
                <Navigation size={17} />
                <div>
                  <strong>Travel radius</strong>
                  <small>Maximum distance from your origin</small>
                </div>
              </div>
              <output htmlFor="radius">{radius} miles</output>
              <input
                aria-label="Service radius in miles"
                id="radius"
                type="range"
                min={1}
                max={50}
                step={0.5}
                value={radius}
                onChange={(event) => setRadius(Number(event.target.value))}
              />
            </div>
            <div className="coordinate-row">
              <span>Exact origin coordinates</span>
              <code>
                {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </code>
            </div>
            <p className="panel-description">
              Write the store address manually, then place the marker on the exact arrival point. We
              keep the coordinates for routing and show the store marker once it is saved.
            </p>
          </div>
        </section>

        <aside className="mobile-service-sidebar">
          <section className="panel">
            <div className="panel-header service-panel-header">
              <div>
                <h2>Travel fee</h2>
                <p className="panel-description">Added to the service price.</p>
              </div>
            </div>
            <div className="panel-body form-stack">
              <div
                className="segmented fee-segments"
                role="group"
                aria-label="Travel fee structure"
              >
                {(['flat', 'per_mile', 'free'] as const).map((structure) => (
                  <button
                    key={structure}
                    className={feeStructure === structure ? 'is-active' : ''}
                    type="button"
                    onClick={() => setFeeStructure(structure)}
                  >
                    {structure === 'per_mile'
                      ? 'Per mile'
                      : structure[0]?.toUpperCase() + structure.slice(1)}
                  </button>
                ))}
              </div>
              {feeStructure !== 'free' && (
                <div className="field">
                  <label htmlFor="fee">
                    {feeStructure === 'flat' ? 'Flat fee' : 'Rate per mile'}
                  </label>
                  <div className="money-input">
                    <span>$</span>
                    <input
                      id="fee"
                      min={0}
                      step="0.01"
                      type="number"
                      value={fee}
                      onChange={(event) => setFee(event.target.value)}
                    />
                  </div>
                </div>
              )}
              {selectedSuggestion !== undefined && feeStructure !== 'free' && (
                <div className="suggestion-row">
                  <div>
                    <strong>Suggested ${(selectedSuggestion / 100).toFixed(2)}</strong>
                    <small>{suggestion?.rationale}</small>
                  </div>
                  <button
                    className="button button-ghost"
                    type="button"
                    onClick={() => setFee(String(selectedSuggestion / 100))}
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header service-panel-header">
              <div>
                <h2>Client notes</h2>
                <p className="panel-description">Shown before clients confirm.</p>
              </div>
            </div>
            <div className="panel-body form-stack">
              <div className="field">
                <label htmlFor="notes">Visit requirements</label>
                <textarea
                  className="textarea mobile-notes"
                  id="notes"
                  maxLength={1000}
                  placeholder="Equipment, lighting, parking, or space requirements"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
                <small className="field-hint">{notes.length}/1000</small>
              </div>
            </div>
          </section>

          <button
            className="button button-primary button-full save-mobile-settings"
            disabled={mutation.isPending || originAddress.trim().length === 0 || !feeIsValid}
            onClick={() => mutation.mutate()}
            type="button"
          >
            <Save size={17} />
            {mutation.isPending ? 'Saving...' : 'Save mobile settings'}
          </button>
        </aside>
      </div>
    </main>
  );
}
