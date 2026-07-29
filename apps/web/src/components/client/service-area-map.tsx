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

import type { MapPoint } from '@/components/client/client-map';

const serviceMapStyle =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

type ServiceAreaMapProps = {
  center: MapPoint;
  destination?: MapPoint | null;
  interactive?: boolean;
  radiusMiles?: number | null;
  markerVariant?: 'pin' | 'store';
  zoom?: number;
  onDestinationChange?: (point: MapPoint) => void;
};

const milesToMeters = (miles: number): number => miles * 1609.344;

type GeoJSONFeature = {
  type: 'Feature';
  properties: Record<string, never>;
  geometry: { type: 'Polygon'; coordinates: number[][][] };
};

function circleGeometry(center: MapPoint, radiusMiles: number): GeoJSONFeature {
  const points = 64;
  const radius = milesToMeters(radiusMiles);
  const coordinates = Array.from({ length: points + 1 }, (_, index) => {
    const angle = (index / points) * Math.PI * 2;
    const dx = Math.cos(angle) * radius;
    const dy = Math.sin(angle) * radius;
    const latitudeOffset = dy / 111_320;
    const longitudeOffset = dx / (111_320 * Math.cos((center.latitude * Math.PI) / 180) || 1);
    return [center.longitude + longitudeOffset, center.latitude + latitudeOffset];
  });
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coordinates] },
  };
}

export function ServiceAreaMap({
  center,
  destination = null,
  interactive = true,
  markerVariant = 'pin',
  onDestinationChange,
  radiusMiles = 10,
  zoom = 11,
}: ServiceAreaMapProps): React.ReactElement {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLibreMap | null>(null);
  const destinationMarker = useRef<Marker | null>(null);
  const onChange = useRef(onDestinationChange);
  const observer = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    onChange.current = onDestinationChange;
  }, [onDestinationChange]);

  useEffect(() => {
    if (container.current === null) return;
    const instance = new MapLibreMap({
      container: container.current,
      style: serviceMapStyle,
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
      destinationMarker.current = null;
      instance.remove();
      map.current = null;
    };
  }, [interactive, zoom]);

  useEffect(() => {
    map.current?.easeTo({ center: [center.longitude, center.latitude], zoom, duration: 400 });
  }, [center.latitude, center.longitude, zoom]);

  useEffect(() => {
    const instance = map.current;
    if (instance === null) return;
    destinationMarker.current?.remove();
    destinationMarker.current = null;
    if (destination === null) return;

    const element = document.createElement('div');
    element.className = markerVariant === 'store' ? 'barber-map-store' : 'barber-map-pin';
    element.setAttribute(
      'aria-label',
      markerVariant === 'store' ? 'Store location' : 'Service destination',
    );
    const marker = new Marker({ element, draggable: interactive })
      .setLngLat([destination.longitude, destination.latitude])
      .addTo(instance);
    if (interactive) {
      marker.on('dragend', () => {
        const point = marker.getLngLat();
        onChange.current?.({ latitude: point.lat, longitude: point.lng });
      });
    }
    destinationMarker.current = marker;
    return (): void => {
      marker.remove();
    };
  }, [destination?.latitude, destination?.longitude, interactive, markerVariant]);

  useEffect(() => {
    const instance = map.current;
    if (instance === null) return;
    const syncCircle = (): void => {
      if (radiusMiles === null) {
        if (instance.getLayer('service-radius-line') !== undefined) {
          instance.removeLayer('service-radius-line');
        }
        if (instance.getLayer('service-radius-fill') !== undefined) {
          instance.removeLayer('service-radius-fill');
        }
        if (instance.getSource('service-radius') !== undefined) {
          instance.removeSource('service-radius');
        }
        return;
      }
      const sourceData = circleGeometry(center, radiusMiles);
      if (instance.getSource('service-radius') === undefined) {
        instance.addSource('service-radius', { type: 'geojson', data: sourceData });
        instance.addLayer({
          id: 'service-radius-fill',
          type: 'fill',
          source: 'service-radius',
          paint: { 'fill-color': '#b6f0da', 'fill-opacity': 0.16 },
        });
        instance.addLayer({
          id: 'service-radius-line',
          type: 'line',
          source: 'service-radius',
          paint: { 'line-color': '#2b8f69', 'line-width': 2 },
        });
      } else {
        (instance.getSource('service-radius') as GeoJSONSource).setData(sourceData);
      }
    };
    if (instance.loaded()) syncCircle();
    else void instance.once('load', syncCircle);
  }, [center.latitude, center.longitude, radiusMiles]);

  useEffect(() => {
    const instance = map.current;
    if (instance === null || !interactive || destination === null) return;
    const handleClick = (event: MapMouseEvent): void => {
      onChange.current?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
    };
    instance.on('click', handleClick);
    return (): void => {
      instance.off('click', handleClick);
    };
  }, [destination, interactive]);

  useEffect(() => {
    const instance = map.current;
    if (instance === null || destination === null) return;
    if (center.latitude === destination.latitude && center.longitude === destination.longitude) {
      instance.easeTo({
        center: [center.longitude, center.latitude],
        zoom: Math.min(zoom, 15),
        duration: 400,
      });
      return;
    }
    const bounds = new LngLatBounds(
      [center.longitude, center.latitude] as LngLatLike,
      [destination.longitude, destination.latitude] as LngLatLike,
    );
    instance.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 400 });
  }, [center.latitude, center.longitude, destination?.latitude, destination?.longitude, zoom]);

  return <div className="service-area-map" ref={container} />;
}
