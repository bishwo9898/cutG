'use client';

import Link from 'next/link';

import { useUser } from '@/hooks/use-user';

export default function ClientProfilePage(): React.ReactElement {
  const { data: user } = useUser();
  return (
    <main className="market-page narrow-page">
      <header className="market-nav">
        <Link className="brand-lockup dark" href="/client">
          <span className="brand-mark">cG</span>cutG
        </Link>
        <nav>
          <Link href="/client/profile/addresses">Saved addresses</Link>
          <Link href="/client/appointments">Appointments</Link>
        </nav>
      </header>
      <section className="summary-panel">
        <p className="eyebrow">Client profile</p>
        <h1>{user === undefined ? 'Your profile' : `${user.firstName} ${user.lastName}`}</h1>
        <p className="muted">{user?.email}</p>
        <Link className="button button-primary" href="/client/profile/addresses">
          Manage service addresses
        </Link>
      </section>
    </main>
  );
}
