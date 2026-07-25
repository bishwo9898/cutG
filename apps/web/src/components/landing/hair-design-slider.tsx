'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeftRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type SliderStyle = {
  name: string;
  detail: string;
  note: string;
  afterSrc: string;
  accentClass: string;
};

const styles: SliderStyle[] = [
  {
    name: 'Low taper',
    detail: 'Soft temple taper with shape retained on top.',
    note: 'Most requested for natural texture and clean growth.',
    afterSrc: '/images/barbers/barber-2.webp',
    accentClass: 'is-gold',
  },
  {
    name: 'Textured top',
    detail: 'More movement on top with a cleaner outline.',
    note: 'Best when you want volume without losing control.',
    afterSrc: '/images/barbers/barber-3.webp',
    accentClass: 'is-bronze',
  },
  {
    name: 'Beard blend',
    detail: 'Sharper beard transition and lower side clean-up.',
    note: 'Useful when the client needs a full face-and-cut plan.',
    afterSrc: '/images/barbers/barber-1.webp',
    accentClass: 'is-ivory',
  },
];

export function HairDesignSlider(): React.ReactElement {
  if (styles.length === 0) {
    return <div className="landing-cinematic-slider-shell" aria-hidden="true" />;
  }

  const [activeIndex, setActiveIndex] = useState(0);
  const [sliderPosition, setSliderPosition] = useState(45);
  const [isDragging, setIsDragging] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const activeStyle =
    styles[activeIndex] ??
    styles[0] ?? {
      name: '',
      detail: '',
      note: '',
      afterSrc: '/images/barbers/barber-1.webp',
      accentClass: 'is-gold',
    };

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
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isDragging]);

  const selectStyle = (index: number): void => {
    if (index === activeIndex) return;
    setIsTransitioning(true);
    window.setTimeout(() => {
      setActiveIndex(index);
      setSliderPosition(45);
    }, 180);
    window.setTimeout(() => {
      setIsTransitioning(false);
    }, 420);
  };

  return (
    <div className="landing-cinematic-slider-shell">
      <div
        className={`landing-cinematic-slider-frame ${activeStyle.accentClass}`}
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
          className={`landing-cinematic-slider-layer landing-cinematic-slider-after${isTransitioning ? ' is-transitioning' : ''}`}
          style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
        >
          <Image
            alt={`${activeStyle.name} haircut preview`}
            fill
            sizes="(max-width: 900px) 100vw, 50vw"
            src={activeStyle.afterSrc}
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
            <span className="landing-cinematic-preview-chip">Demo concept</span>
            <strong>{activeStyle.name}</strong>
            <p>{activeStyle.detail}</p>
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

        {isTransitioning && <div className="landing-cinematic-slider-shimmer" />}
      </div>

      <div className="landing-cinematic-style-tabs" role="tablist" aria-label="Hair preview styles">
        {styles.map((style, index) => (
          <button
            aria-selected={index === activeIndex}
            className={index === activeIndex ? 'is-active' : ''}
            key={style.name}
            onClick={() => selectStyle(index)}
            role="tab"
            type="button"
          >
            {style.name}
          </button>
        ))}
      </div>

      <div className="landing-cinematic-slider-footer">
        <div>
          <p>{activeStyle.note}</p>
          <small>Scan your face. Pick a style. See the outcome before the chair.</small>
        </div>
        <Link className="landing-cinematic-button landing-cinematic-button-primary" href="/client/design">
          Try it free
        </Link>
      </div>
    </div>
  );
}
