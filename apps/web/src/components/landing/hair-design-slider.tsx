'use client';

import { ArrowLeftRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';

const beforeImage = '/images/landing/hair-preview-before.webp';
const afterImage = '/images/landing/hair-preview-after.png';

export function HairDesignSlider(): React.ReactElement {
  const [sliderPosition, setSliderPosition] = useState(50);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = (clientX: number): void => {
    const frame = frameRef.current;
    if (frame === null) return;
    const rect = frame.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setSliderPosition(Math.min(100, Math.max(0, next)));
  };

  return (
    <div className="landing-cinematic-slider-shell">
      <div
        className="landing-cinematic-slider-frame"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          updatePosition(event.clientX);
        }}
        onPointerEnter={(event) => updatePosition(event.clientX)}
        onPointerMove={(event) => updatePosition(event.clientX)}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        ref={frameRef}
      >
        <div className="landing-cinematic-slider-layer">
          <Image
            alt="Before haircut"
            fill
            priority
            sizes="(max-width: 440px) 100vw, 440px"
            src={beforeImage}
          />
        </div>

        <div
          className="landing-cinematic-slider-layer landing-cinematic-slider-after"
          style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
        >
          <Image
            alt="After haircut"
            fill
            sizes="(max-width: 440px) 100vw, 440px"
            src={afterImage}
          />
        </div>

        <div className="landing-cinematic-slider-divider" style={{ left: `${sliderPosition}%` }}>
          <button
            aria-label="Adjust before and after preview"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(sliderPosition)}
            aria-valuetext={`${Math.round(sliderPosition)}% after photo shown`}
            className="landing-cinematic-slider-handle"
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                setSliderPosition((current) => Math.max(0, current - 5));
              }
              if (event.key === 'ArrowRight') {
                event.preventDefault();
                setSliderPosition((current) => Math.min(100, current + 5));
              }
            }}
            role="slider"
            tabIndex={0}
            type="button"
          >
            <ArrowLeftRight size={18} />
          </button>
        </div>
      </div>

      <div className="landing-cinematic-slider-footer">
        <div>
          <p>One realistic preview, attached to the booking before the chair ever turns.</p>
          <small>Keep the haircut conversation clear before the first pass.</small>
        </div>
        <Link className="landing-cinematic-button landing-cinematic-button-primary" href="/client/design">
          Try it free
        </Link>
      </div>
    </div>
  );
}
