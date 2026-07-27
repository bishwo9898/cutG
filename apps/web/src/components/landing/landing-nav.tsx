'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const links = [
  { href: '#hair-design', label: 'AI Preview' },
  { href: '#tracking', label: 'Mobile Service' },
  { href: '#for-barbers', label: 'For Barbers' },
];

export function LandingNav(): React.ReactElement {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
          <Link href="/client/login">Sign in</Link>
        </nav>

        <div className="landing-cinematic-nav-actions">
          <Link className="landing-cinematic-button landing-cinematic-button-ghost" href="/barber/register">
            I&apos;m a barber
          </Link>
          <Link className="landing-cinematic-button landing-cinematic-button-primary" href="/client/register">
            Get started
          </Link>
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
            href="/client/register"
            onClick={() => setMenuOpen(false)}
          >
            Get started
          </Link>
        </div>
      </div>
    </>
  );
}
