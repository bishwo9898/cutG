'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  ChevronDown,
  Heart,
  LogOut,
  MapPin,
  Scissors,
  Search,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { BackButton } from '@/components/back-button';
import { useUser } from '@/hooks/use-user';

const clientLinks = [
  { href: '/client/barbers', label: 'Find barbers', icon: Search },
  { href: '/client/appointments', label: 'Appointments', icon: CalendarDays },
  { href: '/client/saved', label: 'Saved', icon: Heart },
  { href: '/client/profile', label: 'Profile', icon: UserRound },
];

const active = (pathname: string, href: string): boolean => pathname.startsWith(href);

export function ClientHeader(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useUser();
  const [query, setQuery] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const client = user.data?.userType === 'CLIENT' ? user.data : null;
  const initials = client === null ? '' : `${client.firstName[0] ?? ''}${client.lastName[0] ?? ''}`;

  const search = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const value = query.trim();
    router.push(
      value.length === 0 ? '/client/barbers' : `/client/barbers?q=${encodeURIComponent(value)}`,
    );
  };

  const signOut = async (): Promise<void> => {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      queryClient.clear();
      router.replace('/client/login');
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <header className="client-header">
        <Link className="brand-lockup dark" href="/client">
          <span className="brand-mark">
            <Scissors size={18} />
          </span>
          cutG
        </Link>
        <form className="client-header-search" onSubmit={search}>
          <Search size={16} />
          <input
            aria-label="Search barbers"
            placeholder="Search barbers in Danville, KY..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </form>
        <nav className="client-primary-nav" aria-label="Client portal">
          {clientLinks.slice(0, 3).map((item) => (
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
          {client !== null ? (
            <details className="client-account-menu">
              <summary>
                <span className="client-avatar">{initials}</span>
                <span>{client.firstName}</span>
                <ChevronDown size={15} />
              </summary>
              <div className="client-account-dropdown">
                <div className="client-account-summary">
                  <strong>
                    {client.firstName} {client.lastName}
                  </strong>
                  <span>{client.email}</span>
                </div>
                <Link href="/client/profile">
                  <UserRound size={16} /> My profile
                </Link>
                <Link href="/client/profile/addresses">
                  <MapPin size={16} /> My addresses
                </Link>
                <button disabled={signingOut} onClick={() => void signOut()} type="button">
                  <LogOut size={16} /> {signingOut ? 'Signing out...' : 'Sign out'}
                </button>
              </div>
            </details>
          ) : user.isLoading ? (
            <span className="client-auth-skeleton" aria-label="Loading account" />
          ) : (
            <>
              <Link className="text-link" href="/client/login">
                Sign in
              </Link>
              <Link className="button button-primary" href="/client/register">
                Create account
              </Link>
            </>
          )}
        </div>
      </header>
      {pathname !== '/client' && (
        <div className="client-backbar">
          <BackButton fallbackHref="/client" />
        </div>
      )}
      <nav className="client-mobile-nav" aria-label="Client mobile navigation">
        {(client === null && !user.isLoading ? clientLinks.slice(0, 1) : clientLinks).map(
          (item) => {
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
          },
        )}
        {client === null && !user.isLoading && (
          <Link href="/client/login">
            <UserRound size={18} />
            <span>Sign in</span>
          </Link>
        )}
      </nav>
    </>
  );
}
