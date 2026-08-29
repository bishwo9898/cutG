'use client';

import { useEffect, useRef, useState } from 'react';

type LandingSectionProps = {
  children: React.ReactNode;
  className?: string;
  id?: string;
};

export function LandingSection({
  children,
  className = '',
  id,
}: LandingSectionProps): React.ReactElement {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (section === null) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsVisible(true);
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry === undefined || !entry.isIntersecting) return;
        setIsVisible(true);
        observer.unobserve(entry.target);
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.14 },
    );

    observer.observe(section);
    return (): void => observer.disconnect();
  }, []);

  return (
    <section
      className={`landing-scroll-reveal${isVisible ? ' is-visible' : ''} ${className}`.trim()}
      id={id}
      ref={sectionRef}
    >
      {children}
    </section>
  );
}
