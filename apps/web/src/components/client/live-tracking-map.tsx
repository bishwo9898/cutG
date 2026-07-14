'use client';

import { clientApi } from '@barber-saas/api-client';
import { useQuery } from '@tanstack/react-query';
import { Car, Scissors } from 'lucide-react';

import { StaticMap } from '@/components/client/static-map';
import { SimpleMap } from '@/components/maps/simple-map';
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
  const tracking: ActiveBarberLocation | null = isActiveLocation(location.data)
    ? location.data
    : null;
  const ping = tracking?.lastPing ?? null;

  if (!active || tracking === null || ping === null) {
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
  return (
    <div className="tracking-map-shell">
      <SimpleMap
        height={240}
        points={[
          {
            latitude: ping.latitude,
            longitude: ping.longitude,
            label: `${tracking.barberName} live location`,
            kind: 'barber',
          },
          {
            latitude: clientLatitude,
            longitude: clientLongitude,
            label: address,
            kind: 'destination',
          },
        ]}
      />
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
