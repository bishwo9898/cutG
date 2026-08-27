'use client';

import { useClerk } from '@clerk/nextjs';
import {
  BadgeCheck,
  CalendarDays,
  CreditCard,
  DollarSign,
  Images,
  LayoutDashboard,
  MapPinned,
  LogOut,
  Scissors,
  Store,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { BackButton } from '@/components/back-button';
import { BarberLocationAccess } from '@/components/barber-location-access';
import { useUser } from '@/hooks/use-user';

const navItems = [
  { href: '/barber/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/barber/dashboard/portfolio', label: 'Portfolio', icon: Images },
  { href: '/barber/dashboard/services', label: 'Services', icon: Scissors },
  { href: '/barber/dashboard/availability', label: 'Availability', icon: CalendarDays },
  { href: '/barber/dashboard/mobile-service', label: 'Mobile service', icon: MapPinned },
  { href: '/barber/dashboard/appointments', label: 'Appointments', icon: Store },
  { href: '/barber/dashboard/payments', label: 'Payments', icon: CreditCard },
  { href: '/barber/dashboard/earnings', label: 'Earnings', icon: DollarSign },
  { href: '/barber/dashboard/subscription', label: 'Subscription', icon: BadgeCheck },
];

const mobileNavItems = [
  navItems[0],
  navItems[5],
  navItems[3],
  navItems[2],
  navItems[4],
].filter((item): item is (typeof navItems)[number] => item !== undefined);

const isActive = (pathname: string, href: string): boolean =>
  href === '/barber/dashboard' ? pathname === href : pathname.startsWith(href);

export function DashboardShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut: clerkSignOut } = useClerk();
  const userQuery = useUser();
  const user = userQuery.data;
  const initials =
    user === undefined
      ? 'B'
      : `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  const logout = async (): Promise<void> => {
    await clerkSignOut();
    router.replace('/barber/login');
    router.refresh();
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand-lockup" href="/barber/dashboard">
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
          <Link className="brand-lockup" href="/barber/dashboard">
            <Scissors size={17} />
            cutG
          </Link>
          <span className="topbar-label">Barber workspace</span>
        </header>
        {pathname !== '/barber/dashboard' && (
          <div className="dashboard-backbar">
            <BackButton fallbackHref="/barber/dashboard" />
          </div>
        )}
        {(pathname.startsWith('/barber/dashboard/appointments') ||
          pathname.startsWith('/barber/dashboard/mobile-service')) && <BarberLocationAccess />}
        {children}
      </div>
      <nav className="mobile-nav" aria-label="Mobile dashboard">
        {mobileNavItems.map((item) => {
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
