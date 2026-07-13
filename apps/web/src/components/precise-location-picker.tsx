'use client';

import {
  Autocomplete,
  GoogleMap,
  LoadScript,
  MarkerF,
  type Libraries,
} from '@react-google-maps/api';
import { Crosshair, LocateFixed, MapPin } from 'lucide-react';
import { useRef, useState } from 'react';

import { Notice } from '@/components/notice';
import {
  placeToResolvedAddress,
  reverseGeocodeCoordinates,
  type ResolvedGoogleAddress,
} from '@/lib/google-address';

const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const mapsLibraries: Libraries = ['places'];
const danvilleCenter = { lat: 37.6456, lng: -84.7722 };

type PreciseLocationPickerProps = {
  value: ResolvedGoogleAddress | null;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onLocationChange: (value: ResolvedGoogleAddress) => void;
  inputId: string;
  placeholder?: string;
};

export function PreciseLocationPicker({
  inputId,
  onLocationChange,
  onSearchValueChange,
  placeholder = 'Search a complete street address',
  searchValue,
  value,
}: PreciseLocationPickerProps): React.ReactElement {
  const autocomplete = useRef<google.maps.places.Autocomplete | null>(null);
  const resolveSequence = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [loadingMaps, setLoadingMaps] = useState(true);
  const [locating, setLocating] = useState(false);
  const [pendingPoint, setPendingPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [resolvingPin, setResolvingPin] = useState(false);

  const choosePlace = (): void => {
    const place = autocomplete.current?.getPlace();
    if (place === undefined) return;
    const resolved = placeToResolvedAddress(place);
    if (resolved === null) {
      setError('Choose a complete address from the suggestions so the exact pin can be set.');
      return;
    }
    resolveSequence.current += 1;
    setPendingPoint(null);
    setError(null);
    onSearchValueChange(resolved.formattedAddress);
    onLocationChange(resolved);
  };

  const chooseCoordinates = (latitude: number, longitude: number): void => {
    const sequence = ++resolveSequence.current;
    setPendingPoint({ lat: latitude, lng: longitude });
    setResolvingPin(true);
    setError(null);
    void (async (): Promise<void> => {
      const resolved = await reverseGeocodeCoordinates(latitude, longitude);
      if (sequence !== resolveSequence.current) return;
      setResolvingPin(false);
      if (resolved === null) {
        setPendingPoint(null);
        setError(
          'That pin could not be matched to a street address. Try a nearby building entrance.',
        );
        return;
      }
      onSearchValueChange(resolved.formattedAddress);
      onLocationChange(resolved);
      setPendingPoint(null);
    })();
  };

  const useCurrentLocation = (): void => {
    setError(null);
    if (!('geolocation' in navigator)) {
      setError('Location access is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        chooseCoordinates(coords.latitude, coords.longitude);
      },
      (geolocationError) => {
        setLocating(false);
        setError(
          geolocationError.code === geolocationError.PERMISSION_DENIED
            ? 'Allow location access in your browser settings, then try again.'
            : 'Your current location could not be determined.',
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 15_000 },
    );
  };

  if (mapsKey.length === 0) {
    return (
      <Notice tone="warning">
        Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to use precise suggestions and pin placement. Saved
        addresses can still be entered manually.
      </Notice>
    );
  }

  const selectedPoint =
    pendingPoint ?? (value === null ? null : { lat: value.latitude, lng: value.longitude });
  const center = selectedPoint ?? danvilleCenter;

  return (
    <LoadScript
      googleMapsApiKey={mapsKey}
      libraries={mapsLibraries}
      onError={() => {
        setLoadingMaps(false);
        setError('Google Maps could not load. Check this web key and its localhost restrictions.');
      }}
      onLoad={() => setLoadingMaps(false)}
    >
      <div className="precise-location-picker">
        <div className="precise-location-controls">
          <Autocomplete
            onLoad={(instance) => {
              autocomplete.current = instance;
            }}
            onPlaceChanged={choosePlace}
            onUnmount={() => {
              autocomplete.current = null;
            }}
            options={{
              componentRestrictions: { country: 'us' },
              fields: ['address_components', 'formatted_address', 'geometry', 'name', 'place_id'],
              types: ['address'],
            }}
          >
            <div className="input-with-icon precise-location-search">
              <MapPin size={17} />
              <input
                autoComplete="off"
                id={inputId}
                placeholder={placeholder}
                value={searchValue}
                onChange={(event) => onSearchValueChange(event.target.value)}
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

        <div className="precise-location-map-wrap">
          {loadingMaps && <div className="map-loading-skeleton" role="status" />}
          <GoogleMap
            center={center}
            mapContainerClassName="precise-location-map"
            onClick={(event) => {
              const latitude = event.latLng?.lat();
              const longitude = event.latLng?.lng();
              if (latitude !== undefined && longitude !== undefined) {
                chooseCoordinates(latitude, longitude);
              }
            }}
            options={{
              clickableIcons: false,
              fullscreenControl: false,
              mapTypeControl: true,
              streetViewControl: false,
              zoomControl: true,
            }}
            zoom={selectedPoint === null ? 13 : 18}
          >
            {selectedPoint !== null && (
              <MarkerF
                draggable
                position={selectedPoint}
                title="Exact service location"
                onDragEnd={(event) => {
                  const latitude = event.latLng?.lat();
                  const longitude = event.latLng?.lng();
                  if (latitude !== undefined && longitude !== undefined) {
                    chooseCoordinates(latitude, longitude);
                  }
                }}
              />
            )}
          </GoogleMap>
          <div className="precise-map-hint">
            <Crosshair size={15} /> Click the map or drag the pin to the exact entrance.
          </div>
        </div>

        {resolvingPin && <p className="muted small">Matching the pin to an address...</p>}
        {value !== null && (
          <div className="precise-location-confirmation">
            <div>
              <strong>Exact location selected</strong>
              <span>{value.formattedAddress}</span>
            </div>
            <code>
              {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
            </code>
          </div>
        )}
        {error !== null && <Notice>{error}</Notice>}
      </div>
    </LoadScript>
  );
}
