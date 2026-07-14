'use client';

import { ExternalLink, MapPin } from 'lucide-react';

import { SimpleMap } from '@/components/maps/simple-map';

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
          Open in Google Maps <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}

type StaticMapProps = {
  address: string;
  latitude: number | null;
  longitude: number | null;
  zoom?: number;
  width?: number;
  height?: number;
};

export function StaticMap({
  address,
  height = 220,
  latitude,
  longitude,
}: StaticMapProps): React.ReactElement {
  if (latitude === null || longitude === null) {
    return (
      <MapFallback address={address} height={height} latitude={latitude} longitude={longitude} />
    );
  }
  return (
    <SimpleMap
      height={height}
      points={[{ latitude, longitude, label: address, kind: 'destination' }]}
    />
  );
}
