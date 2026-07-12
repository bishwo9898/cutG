'use client';

import { clientApi } from '@barber-saas/api-client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { AppointmentCard } from '@/components/client-ui';
import { Notice } from '@/components/notice';
import { useUser } from '@/hooks/use-user';
import { browserApi } from '@/lib/browser-api';
import type { ClientAppointment, Pagination } from '@/lib/contracts';

type Response = { appointments: ClientAppointment[]; pagination: Pagination };

export default function ClientAppointmentsPage(): React.ReactElement {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const { data: user, isLoading: userLoading } = useUser();
  const appointments = useQuery({
    enabled: user?.userType === 'CLIENT',
    queryKey: ['client-appointments', tab],
    queryFn: () => clientApi.appointments<Response>(browserApi, { [tab]: true }),
  });

  if (!userLoading && user?.userType !== 'CLIENT') {
    return (
      <main className="market-page narrow-page">
        <Notice>Sign in with a client account to view appointments.</Notice>
        <Link className="button button-primary" href="/login/client">
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="market-page">
      <header className="market-nav">
        <Link className="brand-lockup dark" href="/">
          <span className="brand-mark">cG</span>
          cutG
        </Link>
        <nav>
          <Link href="/barbers">Find barbers</Link>
          <Link href="/saved">Saved</Link>
        </nav>
      </header>
      <section className="market-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Client</p>
            <h1>Your appointments</h1>
          </div>
          <div className="segmented">
            <button
              className={tab === 'upcoming' ? 'is-active' : ''}
              onClick={() => setTab('upcoming')}
              type="button"
            >
              Upcoming
            </button>
            <button
              className={tab === 'past' ? 'is-active' : ''}
              onClick={() => setTab('past')}
              type="button"
            >
              Past
            </button>
          </div>
        </div>
        <div className="barber-grid">
          {(appointments.data?.appointments ?? []).map((appointment) => (
            <AppointmentCard appointment={appointment} key={appointment.id} />
          ))}
        </div>
      </section>
    </main>
  );
}
