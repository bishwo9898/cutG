'use client';

import { clientApi } from '@barber-saas/api-client';
import { GoogleMap, LoadScript, MarkerF, PolylineF } from '@react-google-maps/api';
import { useQuery } from '@tanstack/react-query';
import { Car, Scissors } from 'lucide-react';

import { MapFallback, StaticMap } from '@/components/client/static-map';
import { browserApi } from '@/lib/browser-api';
import type { BarberLocation } from '@/lib/contracts';

type ActiveBarberLocation = Extract<BarberLocation, { isTracking: true }>;
const isActiveLocation = (value: BarberLocation | undefined): value is ActiveBarberLocation =>
  value?.isTracking === true;

export function LiveTrackingMap({
  address,
  appointmentId,
  clientLatitude,
  clientLongitude,
  status,
  arrivedAt,
}: {
  address: string;
  appointmentId: string;
  clientLatitude: number;
  clientLongitude: number;
  status: string;
  arrivedAt?: string | null | undefined;
}): React.ReactElement {
  const active = status === 'ON_THE_WAY';
  const location = useQuery({
    queryKey: ['barber-location', appointmentId],
    queryFn: () => clientApi.barberLocation<BarberLocation>(browserApi, appointmentId),
    enabled: active,
    refetchInterval: active ? 15_000 : false,
  });
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const tracking: ActiveBarberLocation | null = isActiveLocation(location.data)
    ? location.data
    : null;
  const ping = tracking?.lastPing ?? null;

  if (!active || ping === null) {
    return (
      <div className="tracking-map-shell">
        <StaticMap address={address} latitude={clientLatitude} longitude={clientLongitude} />
        <div className={`tracking-banner${status === 'ARRIVED' ? ' arrived' : ''}`}>
          {status === 'ARRIVED' ? <Scissors size={19} /> : <Car size={19} />}
          <div>
            <strong>{status === 'ARRIVED' ? 'Your barber has arrived' : 'Service location'}</strong>
            <span>
              {status === 'ARRIVED' && arrivedAt != null
                ? `Arrived ${new Date(arrivedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                : location.data?.isTracking === false
                  ? location.data.reason
                  : address}
            </span>
          </div>
        </div>
      </div>
    );
  }
  if (key.length === 0) {
    return (
      <MapFallback
        address={`${tracking?.barberName ?? 'Your barber'} is on the way to ${address}`}
        height={240}
        latitude={clientLatitude}
        longitude={clientLongitude}
      />
    );
  }
  const barber = { lat: ping.latitude, lng: ping.longitude };
  const client = { lat: clientLatitude, lng: clientLongitude };
  return (
    <div className="tracking-map-shell">
      <LoadScript googleMapsApiKey={key}>
        <GoogleMap
          center={{ lat: (barber.lat + client.lat) / 2, lng: (barber.lng + client.lng) / 2 }}
          mapContainerClassName="live-tracking-map"
          options={{ fullscreenControl: false, mapTypeControl: false, streetViewControl: false }}
          zoom={13}
        >
          <MarkerF label="B" position={barber} title="Barber's live location" />
          <MarkerF position={client} title="Service destination" />
          <PolylineF
            options={{ strokeColor: '#2684ff', strokeOpacity: 0.8, strokeWeight: 3 }}
            path={[barber, client]}
          />
        </GoogleMap>
      </LoadScript>
      <div className="tracking-banner">
        <Car size={19} />
        <div>
          <strong>{tracking?.barberName ?? 'Your barber'} is on the way</strong>
          <span>
            About {tracking?.estimatedArrivalMinutes} min ·{' '}
            {tracking?.distanceRemainingMiles.toFixed(1)} miles away · updated {ping.secondsAgo}s
            ago
          </span>
        </div>
      </div>
    </div>
  );
}
