'use client';

import { clientApi } from '@barber-saas/api-client';
import { useMutation } from '@tanstack/react-query';
import { Crosshair, LocateFixed, MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { ClientMap, type MapPoint } from '@/components/client/client-map';
import { Notice } from '@/components/notice';
import { browserApi } from '@/lib/browser-api';

export type ResolvedPinAddress = MapPoint & {
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  formattedAddress: string;
  source?: 'google' | 'coordinate_fallback';
  isApproximateAddress?: boolean;
};

export function PinLocationPicker({
  barberId,
  fallbackAddressContext,
  fallbackCenter,
  initialPoint = null,
  onLocationChange,
}: {
  barberId?: string;
  fallbackAddressContext?: {
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  };
  fallbackCenter: MapPoint;
  initialPoint?: MapPoint | null;
  onLocationChange: (address: ResolvedPinAddress) => void;
}): React.ReactElement {
  const requestedLocation = useRef(false);
  const [point, setPoint] = useState<MapPoint>(initialPoint ?? fallbackCenter);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [lookupNotice, setLookupNotice] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<ResolvedPinAddress | null>(null);
  const fallbackAddress = (coordinates: MapPoint): ResolvedPinAddress => {
    const city = fallbackAddressContext?.city ?? 'Danville';
    const state = fallbackAddressContext?.state ?? 'KY';
    const zipCode = fallbackAddressContext?.zipCode ?? '40422';
    return {
      addressLine1: 'Pinned service location',
      city,
      state,
      zipCode,
      country: 'US',
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      formattedAddress: `Pinned service location near ${city}, ${state} ${zipCode}`,
      source: 'coordinate_fallback',
      isApproximateAddress: true,
    };
  };
  const reverse = useMutation({
    mutationFn: (coordinates: MapPoint) =>
      clientApi.reverseGeocode<ResolvedPinAddress>(
        browserApi,
        coordinates.latitude,
        coordinates.longitude,
        barberId,
      ),
    onSuccess: (address) => {
      setLookupNotice(
        address.isApproximateAddress === true
          ? 'Exact pin saved. Address lookup is unavailable, but your barber will navigate to this pin.'
          : null,
      );
      setSelectedAddress(address);
      onLocationChange(address);
    },
    onError: (_error, coordinates) => {
      const fallback = fallbackAddress(coordinates);
      setLookupNotice(
        'Exact pin saved. Address lookup is unavailable, but your barber will navigate to this pin.',
      );
      setSelectedAddress(fallback);
      onLocationChange(fallback);
    },
  });

  const choosePoint = (coordinates: MapPoint): void => {
    const fallback = fallbackAddress(coordinates);
    setPoint(coordinates);
    setLookupNotice(null);
    setSelectedAddress(fallback);
    onLocationChange(fallback);
    reverse.mutate(coordinates);
  };

  useEffect(() => {
    if (requestedLocation.current || initialPoint !== null) return;
    requestedLocation.current = true;
    if (!('geolocation' in navigator)) {
      setLocationNotice('Move the pin to your exact arrival point.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => choosePoint({ latitude: coords.latitude, longitude: coords.longitude }),
      () => {
        setLocationNotice('The map is centered near the barber. Move the pin to your exact spot.');
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }, [initialPoint]);

  useEffect(() => {
    if (initialPoint === null) return;
    setPoint(initialPoint);
  }, [initialPoint?.latitude, initialPoint?.longitude]);

  return (
    <div className="pin-location-picker">
      <div className="pin-map-frame">
        <ClientMap
          center={point}
          destination={point}
          draggable
          onDestinationChange={choosePoint}
          zoom={17}
        />
        <div className="pin-map-instruction">
          <Crosshair size={15} /> Drag the pin to the exact entrance
        </div>
      </div>
      <div className="pin-location-status" aria-live="polite">
        <span className="pin-location-icon">
          {reverse.isPending ? <LocateFixed size={18} /> : <MapPin size={18} />}
        </span>
        <div>
          <strong>
            {reverse.isPending ? 'Finding the closest address...' : 'Exact destination'}
          </strong>
          <span>
            {selectedAddress?.formattedAddress ??
              'Move the pin to the driveway, entrance, or safest arrival point.'}
          </span>
        </div>
      </div>
      {locationNotice !== null && <Notice tone="warning">{locationNotice}</Notice>}
      {lookupNotice !== null && <Notice tone="success">{lookupNotice}</Notice>}
    </div>
  );
}
