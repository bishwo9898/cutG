'use client';

import { Scissors } from 'lucide-react';
import { useEffect, useState } from 'react';

function resolveLegacySeedCover(src: string | null, alt: string): string | null {
  if (src === null || !src.includes('images.cutg.test')) {
    return src;
  }

  const coverNumber = [...alt].reduce((total, character) => total + character.charCodeAt(0), 0) % 3;

  return `/images/barbers/barber-${coverNumber + 1}.webp`;
}

export function BarberCover({
  alt,
  className = '',
  priority = false,
  src,
}: {
  alt: string;
  className?: string;
  priority?: boolean;
  src: string | null;
}): React.ReactElement {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = resolveLegacySeedCover(src, alt);

  useEffect(() => setFailed(false), [resolvedSrc]);

  return (
    <div className={`barber-cover ${className}`.trim()}>
      {resolvedSrc !== null && !failed ? (
        <img
          alt={alt}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          loading={priority ? 'eager' : 'lazy'}
          onError={() => setFailed(true)}
          src={resolvedSrc}
        />
      ) : (
        <div className="barber-cover-fallback" role="img" aria-label={`${alt} image unavailable`}>
          <Scissors size={32} />
          <span>cutG</span>
        </div>
      )}
    </div>
  );
}
