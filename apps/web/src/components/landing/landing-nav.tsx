'use client';

import { useUser } from '@clerk/nextjs';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const links = [
  { href: '#preview', label: 'Preview' },
  { href: '#tracking', label: 'Mobile Service' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#for-barbers', label: 'For Barbers' },
];

export function LandingNav(): React.ReactElement {
  const headerRef = useRef<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { isLoaded, isSignedIn, user } = useUser();

  /**
   * Scroll state is written straight to the DOM rather than through React.
   *
   * The progress hairline needs a value on every frame, and putting that through `useState` would
   * re-render the whole nav — and everything Clerk hands it — sixty times a second while someone
   * is just scrolling. A class toggle and a custom property cost nothing and the browser animates
   * them off the main thread.
   */
  useEffect(() => {
    const header = headerRef.current;
    if (header === null) return;

    let frame = 0;
    const apply = (): void => {
      frame = 0;
      const y = window.scrollY;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? Math.min(1, Math.max(0, y / scrollable)) : 0;
      header.style.setProperty('--nav-progress', String(progress));
      header.classList.toggle('is-scrolled', y > 18);
    };

    const onScroll = (): void => {
      // Coalesce to one write per frame; scroll fires far more often than the screen refreshes.
      if (frame === 0) frame = window.requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return (): void => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  /**
   * Which section the reader is actually in, so the nav says where they are.
   *
   * The band is the middle of the viewport rather than the whole of it: with sections a screen
   * tall, several are partly visible at once during a scroll, and anchoring on the middle is the
   * one answer that matches what the reader would say they are looking at.
   */
  useEffect(() => {
    const sections = links
      .map((link) => document.querySelector<HTMLElement>(link.href))
      .filter((section): section is HTMLElement => section !== null);
    if (sections.length === 0 || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(`#${entry.target.id}`);
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );

    for (const section of sections) observer.observe(section);
    return (): void => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return (): void => {
      document.body.style.overflow = original;
    };
  }, [menuOpen]);

  // Defaults to the signed-out CTAs until Clerk resolves, avoiding a blank nav flash; corrects to
  // the signed-in state a moment later for anyone who's actually authenticated.
  const signedIn = isLoaded && isSignedIn === true;
  const userType = user?.publicMetadata?.userType;
  const dashboardHref = userType === 'BARBER' ? '/barber/dashboard' : '/client';
  const dashboardLabel = userType === 'BARBER' ? 'Barber dashboard' : 'My account';

  return (
    <>
      <header className="landing-cinematic-nav" ref={headerRef}>
        <Link className="landing-cinematic-brand" href="/" onClick={() => setMenuOpen(false)}>
          <span className="landing-cinematic-brand-mark">cut</span>
          <span>G</span>
        </Link>

        <nav className="landing-cinematic-nav-links" aria-label="Primary">
          {links.map((link) => (
            <Link
              aria-current={activeId === link.href ? 'true' : undefined}
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
          {!signedIn && <Link href="/client/login">Sign in</Link>}
        </nav>

        <div className="landing-cinematic-nav-actions">
          {signedIn ? (
            <Link
              className="landing-cinematic-button landing-cinematic-button-primary"
              href={dashboardHref}
            >
              {dashboardLabel}
            </Link>
          ) : (
            <>
              <Link
                className="landing-cinematic-button landing-cinematic-button-ghost"
                href="/barber/register"
              >
                I&apos;m a barber
              </Link>
              <Link
                className="landing-cinematic-button landing-cinematic-button-primary"
                href="/client/start"
              >
                Find your barber
              </Link>
            </>
          )}
          <button
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="landing-cinematic-menu-button"
            onClick={() => setMenuOpen((current) => !current)}
            type="button"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <span aria-hidden="true" className="landing-cinematic-nav-progress" />
      </header>

      <div className={`landing-cinematic-mobile-sheet${menuOpen ? ' is-open' : ''}`}>
        <div className="landing-cinematic-mobile-sheet-inner">
          {links.map((link) => (
            <Link href={link.href} key={link.href} onClick={() => setMenuOpen(false)}>
              {link.label}
            </Link>
          ))}
          {signedIn ? (
            <Link
              className="landing-cinematic-button landing-cinematic-button-primary"
              href={dashboardHref}
              onClick={() => setMenuOpen(false)}
            >
              {dashboardLabel}
            </Link>
          ) : (
            <>
              <Link href="/client/login" onClick={() => setMenuOpen(false)}>
                Sign in
              </Link>
              <Link
                className="landing-cinematic-button landing-cinematic-button-ghost"
                href="/barber/register"
                onClick={() => setMenuOpen(false)}
              >
                I&apos;m a barber
              </Link>
              <Link
                className="landing-cinematic-button landing-cinematic-button-primary"
                href="/client/start"
                onClick={() => setMenuOpen(false)}
              >
                Find your barber
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
