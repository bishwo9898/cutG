'use client';

import {
  CalendarDays,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Scissors,
  Store,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { useUser } from '@/hooks/use-user';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/services', label: 'Services', icon: Scissors },
  { href: '/dashboard/availability', label: 'Availability', icon: CalendarDays },
  { href: '/dashboard/appointments', label: 'Appointments', icon: Store },
  { href: '/dashboard/profile', label: 'Profile', icon: UserRound },
  { href: '/dashboard/preview', label: 'Public preview', icon: ExternalLink },
];

const isActive = (pathname: string, href: string): boolean =>
  href === '/dashboard' ? pathname === href : pathname.startsWith(href);

export function DashboardShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const userQuery = useUser();
  const user = userQuery.data;
  const initials =
    user === undefined
      ? 'B'
      : `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  const logout = async (): Promise<void> => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand-lockup" href="/dashboard">
          <span className="brand-mark">
            <Scissors size={19} />
          </span>
          cutG
        </Link>
        <nav className="nav-list" aria-label="Dashboard">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className={`nav-link ${isActive(pathname, item.href) ? 'nav-link-active' : ''}`}
                href={item.href}
                key={item.href}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="avatar">{initials}</span>
            <div>
              <strong>
                {user === undefined ? 'Barber account' : `${user.firstName} ${user.lastName}`}
              </strong>
              <span>{user?.email ?? 'Loading account...'}</span>
            </div>
          </div>
          <button className="button button-ghost button-full" onClick={logout} type="button">
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <Link className="brand-lockup" href="/dashboard">
            <Scissors size={17} />
            cutG
          </Link>
          <span className="topbar-label">Barber workspace</span>
        </header>
        {children}
      </div>
      <nav className="mobile-nav" aria-label="Mobile dashboard">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <Link
              className={isActive(pathname, item.href) ? 'nav-link-active' : ''}
              href={item.href}
              key={item.href}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
