'use client';

import { clientApi } from '@barber-saas/api-client';
import { useMutation } from '@tanstack/react-query';
import { Crosshair, LocateFixed, MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { ClientMap, type MapPoint } from '@/components/client/client-map';
import { Notice } from '@/components/notice';
import { browserApi } from '@/lib/browser-api';
import { errorMessage } from '@/lib/errors';

export type ResolvedPinAddress = MapPoint & {
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  formattedAddress: string;
};

export function PinLocationPicker({
  fallbackCenter,
  initialPoint = null,
  onLocationChange,
}: {
  fallbackCenter: MapPoint;
  initialPoint?: MapPoint | null;
  onLocationChange: (address: ResolvedPinAddress) => void;
}): React.ReactElement {
  const requestedLocation = useRef(false);
  const [point, setPoint] = useState<MapPoint>(initialPoint ?? fallbackCenter);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const reverse = useMutation({
    mutationFn: (coordinates: MapPoint) =>
      clientApi.reverseGeocode<ResolvedPinAddress>(
        browserApi,
        coordinates.latitude,
        coordinates.longitude,
      ),
    onSuccess: onLocationChange,
  });

  const choosePoint = (coordinates: MapPoint): void => {
    setPoint(coordinates);
    reverse.mutate(coordinates);
  };

  useEffect(() => {
    if (requestedLocation.current || initialPoint !== null) return;
    requestedLocation.current = true;
    if (!('geolocation' in navigator)) {
      setLocationNotice('Location is unavailable. Move the map and place the pin manually.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => choosePoint({ latitude: coords.latitude, longitude: coords.longitude }),
      () => {
        setLocationNotice(
          'Location access was not available. The map is centered near the barber so you can place the pin manually.',
        );
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
            {reverse.data?.formattedAddress ??
              'Move the pin to the driveway, entrance, or safest arrival point.'}
          </span>
        </div>
      </div>
      {locationNotice !== null && <Notice tone="warning">{locationNotice}</Notice>}
      {reverse.isError && <Notice>{errorMessage(reverse.error)}</Notice>}
    </div>
  );
}
