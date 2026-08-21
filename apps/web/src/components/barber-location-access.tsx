'use client';

import { Check, LocateFixed, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type LocationAccessState =
  | 'checking'
  | 'requesting'
  | 'ready'
  | 'approximate'
  | 'denied'
  | 'unavailable';

const isMobileViewport = (): boolean => window.matchMedia('(max-width: 820px)').matches;

export function BarberLocationAccess(): React.ReactElement | null {
  const [isMobile, setIsMobile] = useState(false);
  const [state, setState] = useState<LocationAccessState>('checking');
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const requestPreciseLocation = useCallback((): void => {
    if (!window.isSecureContext || !('geolocation' in navigator)) {
      setState('unavailable');
      return;
    }

    setState('requesting');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextAccuracy = Math.max(1, Math.round(position.coords.accuracy));
        setAccuracy(nextAccuracy);
        setState(nextAccuracy <= 100 ? 'ready' : 'approximate');
      },
      (error) => {
        setAccuracy(null);
        setState(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  }, []);

  useEffect(() => {
    const mobile = isMobileViewport();
    setIsMobile(mobile);
    if (!mobile) return;

    if (!window.isSecureContext || !('geolocation' in navigator)) {
      setState('unavailable');
      return;
    }

    if (navigator.permissions === undefined) {
      requestPreciseLocation();
      return;
    }

    let active = true;
    void navigator.permissions
      .query({ name: 'geolocation' })
      .then((permission) => {
        if (!active) return;
        if (permission.state === 'denied') {
          setState('denied');
          return;
        }
        requestPreciseLocation();
      })
      .catch(() => {
        if (active) requestPreciseLocation();
      });

    return (): void => {
      active = false;
    };
  }, [requestPreciseLocation]);

  if (!isMobile || state === 'checking') return null;

  const ready = state === 'ready';
  const approximate = state === 'approximate';
  const requesting = state === 'requesting';
  const Icon = ready ? Check : state === 'denied' || state === 'unavailable' ? TriangleAlert : LocateFixed;

  return (
    <section
      aria-live="polite"
      className={`barber-location-access is-${state}`}
      role={state === 'denied' || state === 'unavailable' ? 'alert' : 'status'}
    >
      <span className="barber-location-access-icon">
        <Icon size={18} />
      </span>
      <div>
        <strong>
          {ready
            ? 'Precise location ready'
            : approximate
              ? 'Location is approximate'
              : requesting
                ? 'Requesting precise location…'
                : state === 'denied'
                  ? 'Precise location is turned off'
                  : 'Location is unavailable'}
        </strong>
        <small>
          {ready
            ? `Accuracy is about ${accuracy ?? 1} metres. Keep this tab open while travelling.`
            : approximate
              ? `Accuracy is about ${accuracy ?? 100} metres. Turn on Precise Location in your browser or phone settings.`
              : requesting
                ? 'Choose Allow and enable Precise Location when your browser asks.'
                : state === 'denied'
                  ? 'Allow location for this website in your browser settings before starting a journey.'
                  : 'Use a secure browser with location services enabled to share your journey.'}
        </small>
      </div>
      {!ready && !requesting && (
        <button className="button button-secondary" onClick={requestPreciseLocation} type="button">
          <LocateFixed size={15} /> {approximate ? 'Refresh location' : 'Enable location'}
        </button>
      )}
    </section>
  );
}
