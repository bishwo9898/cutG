'use client';

import { clientApi } from '@barber-saas/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

import { Notice } from '@/components/notice';
import { useUser } from '@/hooks/use-user';
import { browserApi } from '@/lib/browser-api';

type SavedBarber = {
  id: string;
  savedAt: string;
  barber: {
    id: string;
    businessName: string;
    profilePhotoUrl: string | null;
    city: string | null;
    averageRating: number;
  };
};

export default function SavedBarbersPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const { data: user, isLoading: userLoading } = useUser();
  const saved = useQuery({
    enabled: user?.userType === 'CLIENT',
    queryKey: ['saved-barbers'],
    queryFn: () => clientApi.savedBarbers<{ savedBarbers: SavedBarber[] }>(browserApi),
  });
  const remove = useMutation({
    mutationFn: (barberId: string) => clientApi.removeSavedBarber(browserApi, barberId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['saved-barbers'] });
    },
  });

  if (!userLoading && user?.userType !== 'CLIENT') {
    return (
      <main className="market-page narrow-page">
        <Notice>Sign in with a client account to view saved barbers.</Notice>
        <Link className="button button-primary" href="/login">
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
          <Link href="/appointments">Appointments</Link>
        </nav>
      </header>
      <section className="market-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Saved</p>
            <h1>Your favorite barbers</h1>
          </div>
        </div>
        <div className="barber-grid">
          {(saved.data?.savedBarbers ?? []).map(({ barber }) => (
            <article className="market-card compact-card" key={barber.id}>
              <div className="card-body">
                <h3>{barber.businessName}</h3>
                <p className="muted">{barber.city ?? 'Location coming soon'}</p>
                <p>{barber.averageRating.toFixed(1)} rating</p>
                <div className="button-row">
                  <Link className="button button-secondary" href={`/barbers/${barber.id}`}>
                    View
                  </Link>
                  <button
                    className="button button-danger"
                    onClick={() => remove.mutate(barber.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
