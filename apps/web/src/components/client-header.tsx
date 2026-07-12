'use client';

import { CalendarDays, Heart, Scissors, Search, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const clientLinks = [
  { href: '/client/barbers', label: 'Find barbers', icon: Search },
  { href: '/client/appointments', label: 'Appointments', icon: CalendarDays },
  { href: '/client/saved', label: 'Saved', icon: Heart },
  { href: '/client/profile', label: 'Profile', icon: UserRound },
];

const active = (pathname: string, href: string): boolean => pathname.startsWith(href);

export function ClientHeader(): React.ReactElement {
  const pathname = usePathname();
  return (
    <>
      <header className="client-header">
        <Link className="brand-lockup dark" href="/client">
          <span className="brand-mark">
            <Scissors size={18} />
          </span>
          cutG
        </Link>
        <nav className="client-primary-nav" aria-label="Client portal">
          {clientLinks.map((item) => (
            <Link
              className={active(pathname, item.href) ? 'client-nav-active' : ''}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="client-header-actions">
          <Link className="text-link" href="/client/login">
            Sign in
          </Link>
          <Link className="button button-secondary" href="/barber/login">
            Barber portal
          </Link>
        </div>
      </header>
      <nav className="client-mobile-nav" aria-label="Client mobile navigation">
        {clientLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              className={active(pathname, item.href) ? 'client-nav-active' : ''}
              href={item.href}
              key={item.href}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
