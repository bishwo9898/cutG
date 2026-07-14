'use client';

import { ExternalLink, MapPin } from 'lucide-react';
import { useState } from 'react';

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

export function StaticMap({
  address,
  height = 220,
  latitude,
  longitude,
  width = 600,
  zoom = 15,
}: {
  address: string;
  latitude: number | null;
  longitude: number | null;
  zoom?: number;
  width?: number;
  height?: number;
}): React.ReactElement {
  const [failed, setFailed] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  if (apiKey.length === 0 || latitude === null || longitude === null || failed) {
    return (
      <MapFallback address={address} height={height} latitude={latitude} longitude={longitude} />
    );
  }
  const parameters = new URLSearchParams({
    center: `${latitude},${longitude}`,
    zoom: String(zoom),
    size: `${width}x${height}`,
    scale: '2',
    maptype: 'roadmap',
    markers: `color:red|${latitude},${longitude}`,
    key: apiKey,
  });
  return (
    <div className="static-map-frame" style={{ height }}>
      {/* Static Maps is an external generated image, so Next image optimization is not useful. */}
      <img
        alt={`Map showing ${address}`}
        height={height}
        onError={() => setFailed(true)}
        src={`https://maps.googleapis.com/maps/api/staticmap?${parameters.toString()}`}
        width={width}
      />
    </div>
  );
}
