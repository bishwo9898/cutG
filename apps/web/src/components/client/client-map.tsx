'use client';

import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type GeoJSONSource,
  type LngLatLike,
  type MapMouseEvent,
} from 'maplibre-gl';
import { useEffect, useRef } from 'react';

const clientMapStyle =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export type MapPoint = { latitude: number; longitude: number };

type ClientMapProps = {
  center: MapPoint;
  destination?: MapPoint | null;
  origin?: MapPoint | null;
  draggable?: boolean;
  interactive?: boolean;
  zoom?: number;
  onDestinationChange?: (point: MapPoint) => void;
};

export function ClientMap({
  center,
  destination = null,
  draggable = false,
  interactive = true,
  onDestinationChange,
  origin = null,
  zoom = 15,
}: ClientMapProps): React.ReactElement {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLibreMap | null>(null);
  const destinationMarker = useRef<Marker | null>(null);
  const originMarker = useRef<Marker | null>(null);
  const onChange = useRef(onDestinationChange);
  const observer = useRef<ResizeObserver | null>(null);
  type RouteData = {
    type: 'Feature';
    properties: Record<string, never>;
    geometry: { type: 'LineString'; coordinates: [number, number][] };
  };

  useEffect(() => {
    onChange.current = onDestinationChange;
  }, [onDestinationChange]);

  useEffect(() => {
    if (container.current === null) return;
    const instance = new MapLibreMap({
      container: container.current,
      style: clientMapStyle,
      center: [center.longitude, center.latitude],
      zoom,
      interactive,
      attributionControl: { compact: true },
    });
    map.current = instance;
    if (interactive) {
      instance.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
    }
    observer.current = new ResizeObserver(() => {
      requestAnimationFrame(() => instance.resize());
    });
    observer.current.observe(container.current);
    requestAnimationFrame(() => instance.resize());
    return (): void => {
      observer.current?.disconnect();
      observer.current = null;
      destinationMarker.current?.remove();
      originMarker.current?.remove();
      instance.remove();
      map.current = null;
    };
  }, [interactive]);

  useEffect(() => {
    map.current?.easeTo({ center: [center.longitude, center.latitude], zoom, duration: 500 });
  }, [center.latitude, center.longitude, zoom]);

  useEffect(() => {
    const instance = map.current;
    if (instance === null) return;
    destinationMarker.current?.remove();
    destinationMarker.current = null;
    if (destination === null) return;

    const element = document.createElement('div');
    element.className = 'client-map-pin';
    element.setAttribute('aria-label', 'Service destination');
    const marker = new Marker({ element, draggable })
      .setLngLat([destination.longitude, destination.latitude])
      .addTo(instance);
    if (draggable) {
      marker.on('dragend', () => {
        const point = marker.getLngLat();
        onChange.current?.({ latitude: point.lat, longitude: point.lng });
      });
    }
    destinationMarker.current = marker;
    return (): void => {
      marker.remove();
    };
  }, [destination?.latitude, destination?.longitude, draggable]);

  useEffect(() => {
    const instance = map.current;
    if (instance === null) return;
    originMarker.current?.remove();
    originMarker.current = null;
    if (origin === null) return;
    const element = document.createElement('div');
    element.className = 'client-map-origin';
    const marker = new Marker({ element })
      .setLngLat([origin.longitude, origin.latitude])
      .addTo(instance);
    originMarker.current = marker;
    return (): void => {
      marker.remove();
    };
  }, [origin?.latitude, origin?.longitude]);

  useEffect(() => {
    const instance = map.current;
    if (instance === null || origin === null || destination === null) return;
    const sourceData: RouteData = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [origin.longitude, origin.latitude],
          [destination.longitude, destination.latitude],
        ],
      },
    };
    const drawRoute = (): void => {
      if (instance.getSource('client-route') === undefined) {
        instance.addSource('client-route', { type: 'geojson', data: sourceData as never });
        instance.addLayer({
          id: 'client-route-line',
          type: 'line',
          source: 'client-route',
          paint: { 'line-color': '#d7b968', 'line-width': 3, 'line-opacity': 0.85 },
        });
      } else {
        (instance.getSource('client-route') as GeoJSONSource).setData(sourceData as never);
      }
      const bounds = new LngLatBounds(
        [origin.longitude, origin.latitude] as LngLatLike,
        [destination.longitude, destination.latitude] as LngLatLike,
      );
      instance.fitBounds(bounds, { padding: 56, maxZoom: 15, duration: 500 });
    };
    if (instance.loaded()) drawRoute();
    else void instance.once('load', drawRoute);
  }, [destination?.latitude, destination?.longitude, origin?.latitude, origin?.longitude]);

  useEffect(() => {
    const instance = map.current;
    if (instance === null || !interactive || !draggable) return;
    const handleClick = (event: MapMouseEvent): void => {
      onChange.current?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
    };
    instance.on('click', handleClick);
    return (): void => {
      instance.off('click', handleClick);
    };
  }, [draggable, interactive]);

  return <div className="client-map-canvas" ref={container} />;
}
