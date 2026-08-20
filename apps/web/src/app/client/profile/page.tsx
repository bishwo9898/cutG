'use client';

import { clientApi } from '@barber-saas/api-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Heart, LogOut, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ClientHeader } from '@/components/client-header';
import { useUser } from '@/hooks/use-user';
import { browserApi } from '@/lib/browser-api';

export default function ClientProfilePage(): React.ReactElement {
  const { data: user } = useUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const addresses = useQuery({
    queryKey: ['client-addresses'],
    queryFn: () => clientApi.addresses<{ addresses: unknown[] }>(browserApi),
  });
  const saved = useQuery({
    queryKey: ['saved-barbers'],
    queryFn: () => clientApi.savedBarbers<{ savedBarbers: unknown[] }>(browserApi),
  });
  const upcoming = useQuery({
    queryKey: ['client-appointments', 'profile-count'],
    queryFn: () =>
      clientApi.appointments<{ pagination: { total: number } }>(browserApi, {
        upcoming: true,
        limit: 1,
      }),
  });
  const signOut = async (): Promise<void> => {
    await fetch('/api/auth/logout', { method: 'POST' });
    queryClient.clear();
    router.replace('/client/login');
    router.refresh();
  };
  const initials = `${user?.firstName[0] ?? ''}${user?.lastName[0] ?? ''}`;
  return (
    <main className="market-page narrow-page">
      <ClientHeader />
      <section className="summary-panel">
        <p className="eyebrow">Customer profile</p>
        <div className="client-profile-identity">
          <span className="client-profile-avatar">{initials}</span>
          <div>
            <h1>{user === undefined ? 'Your profile' : `${user.firstName} ${user.lastName}`}</h1>
            <p className="muted">{user?.email}</p>
            {user?.phone != null && <p className="muted">{user.phone}</p>}
          </div>
        </div>
        <div className="profile-link-list">
          <Link href="/client/profile/addresses">
            <MapPin size={20} />
            <span>
              <strong>My addresses</strong>
              <small>{addresses.data?.addresses.length ?? 0} saved addresses</small>
            </span>
            <b>Manage →</b>
          </Link>
          <Link href="/client/saved">
            <Heart size={20} />
            <span>
              <strong>Saved barbers</strong>
              <small>{saved.data?.savedBarbers.length ?? 0} saved</small>
            </span>
            <b>View →</b>
          </Link>
          <Link href="/client/appointments">
            <CalendarDays size={20} />
            <span>
              <strong>Appointments</strong>
              <small>{upcoming.data?.pagination.total ?? 0} upcoming</small>
            </span>
            <b>View →</b>
          </Link>
        </div>
        <button className="button button-danger" onClick={() => void signOut()} type="button">
          <LogOut size={16} /> Sign out
        </button>
      </section>
    </main>
  );
}
