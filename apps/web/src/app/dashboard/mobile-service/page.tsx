'use client';

import {
  Autocomplete,
  CircleF,
  GoogleMap,
  LoadScript,
  MarkerF,
  type Libraries,
} from '@react-google-maps/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crosshair, LocateFixed, Map, MapPin, Navigation, Save } from 'lucide-react';
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
const mapsLibraries: Libraries = ['places'];

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
  const [originResolved, setOriginResolved] = useState(false);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [mapLoadError, setMapLoadError] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [mapMode, setMapMode] = useState<'pin' | 'radius'>('radius');
  const circle = useRef<google.maps.Circle | null>(null);
  const autocomplete = useRef<google.maps.places.Autocomplete | null>(null);

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
    setOriginResolved(
      config.data.originAddress !== null && config.data.originAddress !== undefined,
    );
    setNotes(config.data.mobileServiceNotes ?? '');
  }, [config.data]);

  useEffect(() => {
    const mapsWindow = window as Window & { gm_authFailure?: () => void };
    const previousHandler = mapsWindow.gm_authFailure;
    mapsWindow.gm_authFailure = (): void => setMapLoadError(true);
    return (): void => {
      if (previousHandler === undefined) delete mapsWindow.gm_authFailure;
      else mapsWindow.gm_authFailure = previousHandler;
    };
  }, []);

  const setOrigin = (lat: number, lng: number, address?: string): void => {
    setLatitude(lat);
    setLongitude(lng);
    setOriginResolved(address !== undefined);
    if (address !== undefined) setOriginAddress(address);
    setLocationError(null);
  };

  const reverseGeocode = (lat: number, lng: number): void => {
    setOrigin(lat, lng);
    const geocoder = new google.maps.Geocoder();
    void geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      const address = results?.[0]?.formatted_address;
      if (status === google.maps.GeocoderStatus.OK && address !== undefined) {
        setOrigin(lat, lng, address);
      } else setLocationError('The location was selected, but its street address was not found.');
    });
  };

  const selectAutocompletePlace = (): void => {
    const place = autocomplete.current?.getPlace();
    const lat = place?.geometry?.location?.lat();
    const lng = place?.geometry?.location?.lng();
    if (lat === undefined || lng === undefined) {
      setLocationError('Select an address from the suggestions.');
      return;
    }
    setOrigin(lat, lng, place?.formatted_address ?? place?.name);
    setMapMode('pin');
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
        reverseGeocode(coords.latitude, coords.longitude);
        setMapMode('pin');
      },
      (geolocationError) => {
        setLocating(false);
        setLocationError(
          geolocationError.code === geolocationError.PERMISSION_DENIED
            ? 'Location permission was denied. Allow it in your browser settings and try again.'
            : 'Your current location could not be determined.',
        );
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
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

  if (config.isPending) return <LoadingState />;
  const suggestion = config.data?.suggestedFee;
  const selectedSuggestion = feeStructure === 'per_mile' ? suggestion?.perMile : suggestion?.flat;
  const feeIsValid = feeStructure === 'free' || (Number.isFinite(Number(fee)) && Number(fee) >= 0);

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
              <p className="panel-description">Your origin anchors the travel radius.</p>
            </div>
            <span className="radius-badge">{radius} mi</span>
          </div>
          <div className="panel-body service-area-body">
            {mapsKey.length > 0 ? (
              <LoadScript
                googleMapsApiKey={mapsKey}
                libraries={mapsLibraries}
                onError={() => setMapLoadError(true)}
                onLoad={() => setMapLoadError(false)}
              >
                <div className="origin-controls">
                  <Autocomplete
                    onLoad={(instance) => {
                      autocomplete.current = instance;
                    }}
                    onPlaceChanged={selectAutocompletePlace}
                    onUnmount={() => {
                      autocomplete.current = null;
                    }}
                    options={{
                      componentRestrictions: { country: 'us' },
                      fields: ['formatted_address', 'geometry', 'name'],
                      types: ['address'],
                    }}
                  >
                    <div className="input-with-icon origin-input">
                      <MapPin size={18} />
                      <input
                        aria-label="Origin address"
                        autoComplete="off"
                        id="originAddress"
                        placeholder="Search for your starting address"
                        value={originAddress}
                        onChange={(event) => {
                          setOriginAddress(event.target.value);
                          setOriginResolved(false);
                        }}
                      />
                    </div>
                  </Autocomplete>
                  <button
                    className="button button-secondary location-button"
                    disabled={locating}
                    onClick={useCurrentLocation}
                    type="button"
                  >
                    <LocateFixed size={17} />
                    {locating ? 'Locating...' : 'Use my location'}
                  </button>
                </div>
                {locationError !== null && <Notice>{locationError}</Notice>}
                <div className="map-mode-control" role="group" aria-label="Map view">
                  <button
                    className={mapMode === 'pin' ? 'is-active' : ''}
                    onClick={() => setMapMode('pin')}
                    type="button"
                  >
                    <Crosshair size={15} /> Exact pin
                  </button>
                  <button
                    className={mapMode === 'radius' ? 'is-active' : ''}
                    onClick={() => setMapMode('radius')}
                    type="button"
                  >
                    <Map size={15} /> Service area
                  </button>
                </div>
                <GoogleMap
                  center={{ lat: latitude, lng: longitude }}
                  mapContainerClassName="mobile-service-map"
                  onClick={(event) => {
                    const lat = event.latLng?.lat();
                    const lng = event.latLng?.lng();
                    if (lat !== undefined && lng !== undefined) {
                      reverseGeocode(lat, lng);
                      setMapMode('pin');
                    }
                  }}
                  zoom={mapMode === 'pin' ? 18 : radius <= 5 ? 12 : radius <= 15 ? 10 : 9}
                  options={{
                    fullscreenControl: false,
                    mapTypeControl: false,
                    streetViewControl: false,
                    zoomControl: true,
                  }}
                >
                  <MarkerF
                    draggable
                    position={{ lat: latitude, lng: longitude }}
                    onDragEnd={(event) => {
                      const lat = event.latLng?.lat();
                      const lng = event.latLng?.lng();
                      if (lat !== undefined && lng !== undefined) {
                        reverseGeocode(lat, lng);
                        setMapMode('pin');
                      }
                    }}
                  />
                  <CircleF
                    center={{ lat: latitude, lng: longitude }}
                    radius={radius * 1609.344}
                    options={{
                      editable: true,
                      fillColor: '#13795b',
                      fillOpacity: 0.16,
                      strokeColor: '#13795b',
                      strokeOpacity: 0.9,
                      strokeWeight: 2,
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
                Google Maps could not load. Enable Maps JavaScript, Places, and Geocoding APIs, then
                allow http://localhost:3000/* in this key's website restrictions.
              </Notice>
            )}
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
            disabled={
              mutation.isPending ||
              originAddress.trim().length === 0 ||
              !originResolved ||
              !feeIsValid
            }
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
