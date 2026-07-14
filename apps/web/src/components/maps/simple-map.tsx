'use client';

import type { Map as MapLibreMap, Marker, StyleSpecification } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

export type SimpleMapPoint = {
  latitude: number;
  longitude: number;
  label: string;
  kind?: 'origin' | 'destination' | 'barber';
};

type SimpleMapProps = {
  points: SimpleMapPoint[];
  radiusMiles?: number;
  height?: number;
  interactive?: boolean;
  onPointChange?: (latitude: number, longitude: number) => void;
};

const style: StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
};

const circlePolygon = (
  latitude: number,
  longitude: number,
  radiusMiles: number,
): {
  type: 'Feature';
  properties: Record<string, never>;
  geometry: { type: 'Polygon'; coordinates: [number, number][][] };
} => {
  const coordinates: [number, number][] = [];
  const earthRadiusMiles = 3958.8;
  const angularDistance = radiusMiles / earthRadiusMiles;
  const latitudeRadians = (latitude * Math.PI) / 180;
  const longitudeRadians = (longitude * Math.PI) / 180;

  for (let index = 0; index <= 72; index += 1) {
    const bearing = (index / 72) * Math.PI * 2;
    const pointLatitude = Math.asin(
      Math.sin(latitudeRadians) * Math.cos(angularDistance) +
        Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const pointLongitude =
      longitudeRadians +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitudeRadians),
        Math.cos(angularDistance) - Math.sin(latitudeRadians) * Math.sin(pointLatitude),
      );
    coordinates.push([(pointLongitude * 180) / Math.PI, (pointLatitude * 180) / Math.PI]);
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coordinates] },
  };
};

const fitMap = (
  map: MapLibreMap,
  points: SimpleMapPoint[],
  radiusMiles: number | undefined,
): void => {
  const first = points[0];
  if (first === undefined) return;

  if (radiusMiles !== undefined) {
    const latitudeDelta = radiusMiles / 69;
    const longitudeDelta = radiusMiles / Math.max(20, 69 * Math.cos((first.latitude * Math.PI) / 180));
    map.fitBounds(
      [
        [first.longitude - longitudeDelta, first.latitude - latitudeDelta],
        [first.longitude + longitudeDelta, first.latitude + latitudeDelta],
      ],
      { padding: 42, duration: 350, maxZoom: 15 },
    );
    return;
  }

  if (points.length === 1) {
    map.easeTo({ center: [first.longitude, first.latitude], zoom: 15, duration: 350 });
    return;
  }

  const longitudes = points.map((point) => point.longitude);
  const latitudes = points.map((point) => point.latitude);
  map.fitBounds(
    [
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)],
    ],
    { padding: 58, duration: 350, maxZoom: 15 },
  );
};

export function SimpleMap({
  points,
  radiusMiles,
  height = 240,
  interactive = false,
  onPointChange,
}: SimpleMapProps): React.ReactElement {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const pointChange = useRef(onPointChange);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  pointChange.current = onPointChange;

  useEffect(() => {
    if (container.current === null || points[0] === undefined) return;
    let disposed = false;

    void import('maplibre-gl')
      .then((maplibre) => {
        if (disposed || container.current === null) return;
        const instance = new maplibre.Map({
          container: container.current,
          style,
          center: [points[0]?.longitude ?? 0, points[0]?.latitude ?? 0],
          zoom: 14,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          cooperativeGestures: true,
        });
        instance.addControl(new maplibre.AttributionControl({ compact: true }), 'bottom-right');
        instance.touchZoomRotate.disableRotation();
        instance.on('error', (event) => {
          if (event.error.message.includes('Failed to fetch')) setFailed(true);
        });
        instance.on('click', (event) => {
          if (interactive) pointChange.current?.(event.lngLat.lat, event.lngLat.lng);
        });
        map.current = instance;
        setReady(true);
      })
      .catch(() => setFailed(true));

    return (): void => {
      disposed = true;
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      map.current?.remove();
      map.current = null;
    };
    // The map instance is intentionally stable; following effects update its data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (instance === null) return;

    let disposed = false;
    void import('maplibre-gl').then((maplibre) => {
      if (disposed || map.current === null) return;
      markers.current.forEach((marker) => marker.remove());
      markers.current = points.map((point, index) => {
        const element = document.createElement('div');
        element.className = `simple-map-marker simple-map-marker-${point.kind ?? 'destination'}`;
        element.title = point.label;
        element.setAttribute('aria-label', point.label);
        const marker = new maplibre.Marker({
          element,
          draggable: interactive && index === 0,
          anchor: 'center',
        })
          .setLngLat([point.longitude, point.latitude])
          .addTo(map.current as MapLibreMap);
        if (interactive && index === 0) {
          marker.on('dragend', () => {
            const next = marker.getLngLat();
            pointChange.current?.(next.lat, next.lng);
          });
        }
        return marker;
      });
      fitMap(map.current, points, radiusMiles);

      const first = points[0];
      if (first === undefined) return;
      const applyDataLayers = (): void => {
        if (map.current === null) return;

        if (points.length > 1) {
          const routeData = {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: points.map((point) => [point.longitude, point.latitude]),
            },
          } as const;
          const routeSource = map.current.getSource('simple-route') as
            | { setData: (data: typeof routeData) => void }
            | undefined;
          if (routeSource !== undefined) routeSource.setData(routeData);
          else {
            map.current.addSource('simple-route', { type: 'geojson', data: routeData });
            map.current.addLayer({
              id: 'simple-route-line',
              type: 'line',
              source: 'simple-route',
              paint: {
                'line-color': '#2677c9',
                'line-width': 4,
                'line-opacity': 0.72,
                'line-dasharray': [1.4, 1.2],
              },
            });
          }
        }

        if (radiusMiles === undefined) return;
        const radiusData = circlePolygon(first.latitude, first.longitude, radiusMiles);
        const radiusSource = map.current.getSource('service-radius') as
          | { setData: (data: typeof radiusData) => void }
          | undefined;
        if (radiusSource !== undefined) radiusSource.setData(radiusData);
        else {
          map.current.addSource('service-radius', { type: 'geojson', data: radiusData });
          map.current.addLayer({
            id: 'service-radius-fill',
            type: 'fill',
            source: 'service-radius',
            paint: { 'fill-color': '#12725a', 'fill-opacity': 0.12 },
          });
          map.current.addLayer({
            id: 'service-radius-line',
            type: 'line',
            source: 'service-radius',
            paint: { 'line-color': '#12725a', 'line-width': 2 },
          });
        }
      };
      if (map.current.isStyleLoaded()) applyDataLayers();
      else map.current.once('load', applyDataLayers);
    });
    return (): void => {
      disposed = true;
    };
  }, [interactive, points, radiusMiles, ready]);

  return (
    <div className="simple-map-shell" style={{ height }}>
      <div className="simple-map-canvas" ref={container} />
      {failed && (
        <div className="simple-map-error" role="status">
          <strong>Map preview unavailable</strong>
          <span>Your exact address is still saved with this appointment.</span>
        </div>
      )}
    </div>
  );
}
