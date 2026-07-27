'use client';

import { ArrowLeftRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type PreviewConfig = {
  name: string;
  detail: string;
  afterSrc: string;
  accentClass: string;
};

const preview: PreviewConfig = {
  name: 'Natural low taper preview',
  detail: 'One realistic before-and-after mockup so the look is clear before the appointment.',
  afterSrc: '/images/barbers/barber-2.webp',
  accentClass: 'is-gold',
};

export function HairDesignSlider(): React.ReactElement {
  const [sliderPosition, setSliderPosition] = useState(45);
  const [isDragging, setIsDragging] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = (clientX: number): void => {
    const frame = frameRef.current;
    if (frame === null) return;
    const rect = frame.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setSliderPosition(Math.min(85, Math.max(15, next)));
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (event: PointerEvent): void => {
      updatePosition(event.clientX);
    };
    const handleUp = (): void => {
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return (): void => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isDragging]);

  return (
    <div className="landing-cinematic-slider-shell">
      <div
        className={`landing-cinematic-slider-frame ${preview.accentClass}`}
        onPointerDown={(event) => {
          setIsDragging(true);
          updatePosition(event.clientX);
        }}
        ref={frameRef}
      >
        <div className="landing-cinematic-slider-layer">
          <Image
            alt="Before haircut preview"
            fill
            priority
            sizes="(max-width: 900px) 100vw, 50vw"
            src="/images/barbers/barber-1.webp"
          />
        </div>

        <div
          className="landing-cinematic-slider-layer landing-cinematic-slider-after"
          style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
        >
          <Image
            alt={`${preview.name} haircut preview`}
            fill
            sizes="(max-width: 900px) 100vw, 50vw"
            src={preview.afterSrc}
          />
        </div>

        <div className="landing-cinematic-slider-overlay">
          <span className="landing-cinematic-image-label landing-cinematic-image-label-left">
            Before
          </span>
          <span className="landing-cinematic-image-label landing-cinematic-image-label-right">
            AI Preview
          </span>
          <div className="landing-cinematic-slider-copy">
            <span className="landing-cinematic-preview-chip">Single preview</span>
            <strong>{preview.name}</strong>
            <p>{preview.detail}</p>
          </div>
        </div>

        <div className="landing-cinematic-slider-divider" style={{ left: `${sliderPosition}%` }}>
          <button
            aria-label="Adjust before and after preview"
            className="landing-cinematic-slider-handle"
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') {
                setSliderPosition((current) => Math.max(15, current - 5));
              }
              if (event.key === 'ArrowRight') {
                setSliderPosition((current) => Math.min(85, current + 5));
              }
            }}
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
