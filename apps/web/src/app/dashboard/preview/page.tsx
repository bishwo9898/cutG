'use client';

import { useQuery } from '@tanstack/react-query';
import { Clock3, MapPin, Scissors, Star } from 'lucide-react';
import Link from 'next/link';

import { EmptyState, ErrorState, LoadingState } from '@/components/query-states';
import { browserApi } from '@/lib/browser-api';
import type { BarberProfile, BarberService } from '@/lib/contracts';
import { errorMessage } from '@/lib/errors';

export default function PreviewPage(): React.ReactElement {
  const profile = useQuery({
    queryKey: ['barber-profile'],
    queryFn: () => browserApi.get<BarberProfile>('/barbers/me'),
  });
  const services = useQuery({
    queryKey: ['public-services', profile.data?.id],
    queryFn: () =>
      browserApi.get<{ services: BarberService[] }>(`/barbers/${profile.data?.id}/services`),
    enabled: profile.data !== undefined,
  });

  if (profile.isPending) return <LoadingState />;
  if (profile.isError) {
    return (
      <main className="page">
        <section className="panel">
          <ErrorState message={errorMessage(profile.error)} />
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Public profile preview</h1>
          <p>This is the client-facing shape of your business.</p>
        </div>
        <Link className="button button-secondary" href="/barber/dashboard/profile">
          Edit profile
        </Link>
      </div>
      <section className="panel" style={{ overflow: 'hidden' }}>
        <div className="preview-cover">
          <div>
            <span className="badge badge-success">
              {profile.data.isVerified ? 'Verified barber' : 'Barber profile'}
            </span>
            <h2>{profile.data.businessName}</h2>
            <div className="toolbar">
              <span>
                <MapPin size={15} style={{ display: 'inline', marginRight: 5 }} />
                {[profile.data.city, profile.data.state].filter(Boolean).join(', ') ||
                  'Location coming soon'}
              </span>
              <span>
                <Star size={15} style={{ display: 'inline', marginRight: 5 }} />
                {profile.data.averageRating.toFixed(1)} ({profile.data.totalReviews})
              </span>
            </div>
          </div>
        </div>
        <div className="panel-body">
          <p className="subtitle">
            {profile.data.bio ?? 'Add a short introduction to help clients know your craft.'}
          </p>
          <div className="panel-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <h2>Services</h2>
          </div>
          {services.isPending ? (
            <LoadingState />
          ) : (services.data?.services.length ?? 0) === 0 ? (
            <EmptyState title="No active services" detail="Activate a service to show it here." />
          ) : (
            <div className="service-grid">
              {services.data?.services.map((service) => (
                <article className="service-card" key={service.id}>
                  <Scissors size={19} />
                  <h3>{service.name}</h3>
                  <p>{service.description ?? 'A precise service, tailored to you.'}</p>
                  <div className="service-meta">
                    <span>${service.price.toFixed(2)}</span>
                    <span>
                      <Clock3 size={14} style={{ display: 'inline', marginRight: 4 }} />
                      {service.durationMinutes} min
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
