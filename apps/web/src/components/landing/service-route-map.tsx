'use client';

import { Car, Home, Scissors, Store } from 'lucide-react';
import { useState } from 'react';

type ServiceMode = 'mobile' | 'shop';

const ROUTE_PATH =
  'M48,180 C48,140 30,120 55,95 C80,70 120,100 150,80 C185,55 175,20 215,20 C255,20 270,55 310,45 C330,40 344,38 352,44';
const ROUTE_PATH_ID = 'cutg-mobile-route';

export function ServiceRouteMap(): React.ReactElement {
  const [mode, setMode] = useState<ServiceMode>('mobile');

  return (
    <div className="landing-cinematic-map-card">
      <div className="landing-cinematic-mode-toggle" role="tablist" aria-label="Service type">
        <button
          aria-selected={mode === 'mobile'}
          className={mode === 'mobile' ? 'is-active' : ''}
          onClick={() => setMode('mobile')}
          role="tab"
          type="button"
        >
          <Car size={14} /> Mobile barber
        </button>
        <button
          aria-selected={mode === 'shop'}
          className={mode === 'shop' ? 'is-active' : ''}
          onClick={() => setMode('shop')}
          role="tab"
          type="button"
        >
          <Store size={14} /> Shop visit
        </button>
      </div>

      <svg
        aria-hidden="true"
        className="landing-cinematic-route-svg"
        viewBox="0 0 400 220"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect className="route-block" height="46" rx="7" width="70" x="18" y="18" />
        <rect className="route-block" height="30" rx="7" width="52" x="120" y="150" />
        <rect className="route-block" height="60" rx="9" width="86" x="230" y="130" />
        <rect className="route-block" height="34" rx="7" width="60" x="90" y="24" />
        <path
          className="route-park"
          d="M300,150 C316,140 336,144 340,162 C344,180 328,192 310,188 C294,184 286,160 300,150 Z"
        />
        <path
          className="route-park"
          d="M40,60 C54,50 74,54 78,72 C82,90 66,102 48,98 C32,94 26,70 40,60 Z"
        />

        {mode === 'mobile' && (
          <>
            <path className="route-line-glow" d={ROUTE_PATH} />
            <path className="route-line" d={ROUTE_PATH} />
            <g className="route-marker-moving">
              <circle className="route-marker-moving-halo" r="11" />
              <rect fill="var(--ivory-surface)" height="9" rx="2.5" width="17" x="-8.5" y="-5.5" />
              <rect fill="var(--ivory-surface)" height="6" rx="1.5" width="10" x="-5" y="-10" />
              <circle cx="-4.5" cy="4" fill="var(--ivory-ink)" r="2.3" />
              <circle cx="4.5" cy="4" fill="var(--ivory-ink)" r="2.3" />
              <animateMotion dur="7s" keyPoints="0;1;0" keyTimes="0;0.5;1" repeatCount="indefinite" rotate="auto">
                <mpath href={`#${ROUTE_PATH_ID}`} xlinkHref={`#${ROUTE_PATH_ID}`} />
              </animateMotion>
            </g>
            <path className="route-path-ref" d={ROUTE_PATH} id={ROUTE_PATH_ID} />
          </>
        )}

        <g className="route-pin route-pin-origin" transform="translate(48,180)">
          <path
            className="route-pin-shape"
            d="M0,-34 C13,-34 22,-24 22,-12 C22,4 0,26 0,26 C0,26 -22,4 -22,-12 C-22,-24 -13,-34 0,-34 Z"
          />
          <foreignObject height="16" width="16" x="-8" y="-21">
            <Scissors color="var(--ivory-surface)" size={16} />
          </foreignObject>
        </g>

        {mode === 'mobile' && (
          <g className="route-pin route-pin-destination" transform="translate(352,44)">
            <path
              className="route-pin-shape route-pin-shape-destination"
              d="M0,-34 C13,-34 22,-24 22,-12 C22,4 0,26 0,26 C0,26 -22,4 -22,-12 C-22,-24 -13,-34 0,-34 Z"
            />
            <foreignObject height="16" width="16" x="-8" y="-21">
              <Home color="var(--ivory-surface)" size={16} />
            </foreignObject>
          </g>
        )}
      </svg>

      {mode === 'mobile' ? (
        <>
          <div className="landing-cinematic-map-stop landing-cinematic-map-stop-origin">
            <span className="landing-cinematic-map-stop-icon">
              <Scissors size={15} />
            </span>
            <div>
              <strong>Barber studio</strong>
              <small>Kit packed</small>
            </div>
          </div>
          <div className="landing-cinematic-map-stop landing-cinematic-map-stop-destination">
            <span className="landing-cinematic-map-stop-icon">
              <Home size={15} />
            </span>
            <div>
              <strong>Your place</strong>
              <small>Home / office / hotel</small>
            </div>
          </div>
          <div className="landing-cinematic-map-route-pill">On the way · 12 min</div>
          <div className="landing-cinematic-map-service-note">Chair-ready setup</div>
        </>
      ) : (
        <>
          <div className="landing-cinematic-map-stop landing-cinematic-map-stop-shop">
            <span className="landing-cinematic-map-stop-icon">
              <Store size={15} />
            </span>
            <div>
              <strong>Barber studio</strong>
              <small>Danville, KY</small>
            </div>
          </div>
          <div className="landing-cinematic-map-service-note landing-cinematic-map-service-note-shop">
            Walk in or book your slot ahead
          </div>
        </>
      )}
    </div>
  );
}
