'use client';

import { useUser } from '@clerk/nextjs';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AI_STUDIO_PUBLIC } from '@/lib/features';

const links = [
  // The AI Preview link points at the #hair-design section, which is hidden while the feature is
  // still being built — keeping the link would scroll to nothing.
  ...(AI_STUDIO_PUBLIC ? [{ href: '#hair-design', label: 'AI Preview' }] : []),
  { href: '#tracking', label: 'Mobile Service' },
  { href: '#for-barbers', label: 'For Barbers' },
];

export function LandingNav(): React.ReactElement {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    const onScroll = (): void => {
      setIsScrolled(window.scrollY > 18);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return (): void => window.removeEventListener('scroll', onScroll);
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
      <header className={`landing-cinematic-nav${isScrolled ? ' is-scrolled' : ''}`}>
        <Link className="landing-cinematic-brand" href="/">
          <span className="landing-cinematic-brand-mark">cut</span>
          <span>G</span>
        </Link>

        <nav className="landing-cinematic-nav-links" aria-label="Primary">
          {links.map((link) => (
            <Link href={link.href} key={link.href}>
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
