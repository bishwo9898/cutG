'use client';

import { useEffect, useState } from 'react';

export function ActivityTicker({
  items,
}: {
  items: Array<{ location: string; action: string; time: string }>;
}): React.ReactElement {
  if (items.length === 0) {
    return <div className="landing-cinematic-ticker" aria-hidden="true" />;
  }

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % items.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [items.length]);

  const item =
    items[index] ??
    items[0] ?? {
      location: '',
      action: '',
      time: '',
    };

  return (
    <div className="landing-cinematic-ticker" aria-live="polite">
      <span className="landing-cinematic-ticker-dot" />
      <span>
        {item.location} {item.action}
      </span>
      <span className="landing-cinematic-ticker-time">{item.time}</span>
    </div>
  );
}
