'use client';

import { MoveHorizontal } from 'lucide-react';
import { useId, useState } from 'react';

type BeforeAfterSliderProps = {
  beforeUrl: string;
  afterUrl: string;
  title: string;
  className?: string;
};

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  title,
  className = '',
}: BeforeAfterSliderProps): React.ReactElement {
  const id = useId();
  const [position, setPosition] = useState(52);

  return (
    <div className={`portfolio-comparison ${className}`.trim()}>
      <img
        alt={`${title}, before haircut`}
        className="portfolio-comparison-before"
        src={beforeUrl}
      />
      <div
        className="portfolio-comparison-after"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <img alt={`${title}, after haircut`} src={afterUrl} />
      </div>
      <span className="portfolio-image-label is-before">Before</span>
      <span className="portfolio-image-label is-after">After</span>
      <div className="portfolio-comparison-line" style={{ left: `${position}%` }}>
        <span>
          <MoveHorizontal size={17} />
        </span>
      </div>
      <label className="sr-only" htmlFor={id}>
        Compare the before and after photos for {title}
      </label>
      <input
        aria-valuetext={`${position}% after photo shown`}
        id={id}
        max={100}
        min={0}
        onChange={(event) => setPosition(Number(event.target.value))}
        type="range"
        value={position}
      />
    </div>
  );
}
