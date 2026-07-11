'use client';

import { CircleF, GoogleMap, LoadScript, MarkerF } from '@react-google-maps/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Notice } from '@/components/notice';
import { LoadingState } from '@/components/query-states';
import { browserApi } from '@/lib/browser-api';
import { errorMessage } from '@/lib/errors';

type FeeStructure = 'flat' | 'per_mile' | 'free';
type MobileConfig = {
  isEnabled: boolean;
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

const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export default function MobileServicePage(): React.ReactElement {
  const queryClient = useQueryClient();
  const config = useQuery({
    queryKey: ['mobile-config'],
    queryFn: () => browserApi.get<MobileConfig>('/barbers/me/mobile'),
  });
  const [enabled, setEnabled] = useState(false);
  const [radius, setRadius] = useState(10);
  const [feeStructure, setFeeStructure] = useState<FeeStructure>('flat');
  const [fee, setFee] = useState('15');
  const [latitude, setLatitude] = useState(40.6782);
  const [longitude, setLongitude] = useState(-73.9442);
  const [originAddress, setOriginAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [mapLoadError, setMapLoadError] = useState(false);
  const circle = useRef<google.maps.Circle | null>(null);

  useEffect(() => {
    if (config.data === undefined) return;
    setEnabled(config.data.isEnabled);
    setRadius(config.data.serviceRadiusMiles ?? 10);
    setFeeStructure(config.data.feeStructure ?? 'flat');
    setFee(
      String(
        ((config.data.feeStructure === 'per_mile'
          ? config.data.perMileRateCents
          : config.data.baseFeeCents) ?? config.data.suggestedFee.flat) / 100,
      ),
    );
    setLatitude(config.data.originLatitude ?? 40.6782);
    setLongitude(config.data.originLongitude ?? -73.9442);
    setOriginAddress(config.data.originAddress ?? '');
    setNotes(config.data.mobileServiceNotes ?? '');
  }, [config.data]);

  useEffect(() => {
    const mapsWindow = window as Window & { gm_authFailure?: () => void };
    const previousHandler = mapsWindow.gm_authFailure;
    mapsWindow.gm_authFailure = (): void => setMapLoadError(true);
    return (): void => {
      if (previousHandler === undefined) {
        delete mapsWindow.gm_authFailure;
      } else {
        mapsWindow.gm_authFailure = previousHandler;
      }
    };
  }, []);

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

  if (config.isPending) return <LoadingState />;
  const suggestion = config.data?.suggestedFee;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Mobile service</h1>
          <p>Set where you travel and how clients are charged.</p>
        </div>
        <label className="toggle-row">
          <span>{enabled ? 'Enabled' : 'Disabled'}</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
        </label>
      </div>
      {mutation.isError && <Notice>{errorMessage(mutation.error)}</Notice>}
      {saved && <Notice tone="success">Mobile service settings saved.</Notice>}
      <div className="two-column">
        <section className="panel">
          <div className="panel-header">
            <h2>Service area</h2>
          </div>
          <div className="panel-body form-stack">
            {mapsKey.length > 0 ? (
              <LoadScript
                googleMapsApiKey={mapsKey}
                onError={() => setMapLoadError(true)}
                onLoad={() => setMapLoadError(false)}
              >
                <GoogleMap
                  center={{ lat: latitude, lng: longitude }}
                  mapContainerClassName="mobile-service-map"
                  zoom={10}
                  options={{ streetViewControl: false, mapTypeControl: false }}
                >
                  <MarkerF
                    draggable
                    position={{ lat: latitude, lng: longitude }}
                    onDragEnd={(event) => {
                      setLatitude(event.latLng?.lat() ?? latitude);
                      setLongitude(event.latLng?.lng() ?? longitude);
                    }}
                  />
                  <CircleF
                    center={{ lat: latitude, lng: longitude }}
                    radius={radius * 1609.344}
                    options={{
                      editable: true,
                      fillColor: '#e94560',
                      fillOpacity: 0.15,
                      strokeColor: '#e94560',
                      strokeOpacity: 0.8,
                    }}
                    onLoad={(instance) => {
                      circle.current = instance;
                    }}
                    onRadiusChanged={() => {
                      const meters = circle.current?.getRadius();
                      if (meters !== undefined) {
                        setRadius(
                          Math.min(50, Math.max(1, Math.round((meters / 1609.344) * 10) / 10)),
                        );
                      }
                    }}
                    onUnmount={() => {
                      circle.current = null;
                    }}
                  />
                </GoogleMap>
              </LoadScript>
            ) : (
              <Notice>Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to display the editable map.</Notice>
            )}
            {mapLoadError && (
              <Notice>
                Google Maps could not load. Check that Maps JavaScript API and billing are enabled,
                and allow http://localhost:3000/* in this key's website restrictions.
              </Notice>
            )}
            <div className="field">
              <label htmlFor="radius">Service radius: {radius} miles</label>
              <input
                id="radius"
                type="range"
                min={1}
                max={50}
                value={radius}
                onChange={(event) => setRadius(Number(event.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="originAddress">Origin address</label>
              <div className="input-with-icon">
                <MapPin size={17} />
                <input
                  id="originAddress"
                  value={originAddress}
                  onChange={(event) => setOriginAddress(event.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="latitude">Latitude</label>
                <input
                  className="input"
                  id="latitude"
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(event) => setLatitude(Number(event.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="longitude">Longitude</label>
                <input
                  className="input"
                  id="longitude"
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(event) => setLongitude(Number(event.target.value))}
                />
              </div>
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>Travel fee</h2>
          </div>
          <div className="panel-body form-stack">
            <div className="segmented" role="group" aria-label="Travel fee structure">
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
                  {feeStructure === 'flat' ? 'Flat fee ($)' : 'Rate per mile ($)'}
                </label>
                <input
                  className="input"
                  id="fee"
                  min={0}
                  step="0.01"
                  type="number"
                  value={fee}
                  onChange={(event) => setFee(event.target.value)}
                />
              </div>
            )}
            {suggestion !== undefined && feeStructure !== 'free' && (
              <button
                className="button button-secondary"
                type="button"
                onClick={() =>
                  setFee(
                    String(
                      (feeStructure === 'per_mile' ? suggestion.perMile : suggestion.flat) / 100,
                    ),
                  )
                }
              >
                Use suggested $
                {(feeStructure === 'per_mile' ? suggestion.perMile : suggestion.flat) / 100}
              </button>
            )}
            <div className="field">
              <label htmlFor="notes">Notes for clients</label>
              <textarea
                className="textarea"
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>
          <div className="panel-header" style={{ justifyContent: 'flex-end' }}>
            <button
              className="button button-primary"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
              type="button"
            >
              <Save size={17} />
              {mutation.isPending ? 'Saving...' : 'Save settings'}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
