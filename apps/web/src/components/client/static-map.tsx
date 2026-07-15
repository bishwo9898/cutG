'use client';

import { ExternalLink, MapPin } from 'lucide-react';

import { ClientMap } from '@/components/client/client-map';

type MapFallbackProps = {
  address: string;
  latitude: number | null;
  longitude: number | null;
  height: number;
};

export function MapFallback({
  address,
  height,
  latitude,
  longitude,
}: MapFallbackProps): React.ReactElement {
  const query = latitude === null || longitude === null ? address : `${latitude},${longitude}`;
  return (
    <div className="static-map-fallback" style={{ minHeight: height }}>
      <MapPin size={24} />
      <div>
        <strong>Service location</strong>
        <span>{address}</span>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
          rel="noreferrer"
          target="_blank"
        >
          Open directions <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}

export function StaticMap({
  address,
  height = 220,
  latitude,
  longitude,
  zoom = 15,
}: {
  address: string;
  latitude: number | null;
  longitude: number | null;
  zoom?: number;
  width?: number;
  height?: number;
}): React.ReactElement {
  if (latitude === null || longitude === null) {
    return (
      <MapFallback address={address} height={height} latitude={latitude} longitude={longitude} />
    );
  }
  const point = { latitude, longitude };
  return (
    <div className="static-map-frame" style={{ height }} aria-label={`Map showing ${address}`}>
      <ClientMap center={point} destination={point} interactive={false} zoom={zoom} />
    </div>
  );
}
