'use client';

import { ApiError } from '@barber-saas/api-client';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, Scissors, Star, UserRoundPlus } from 'lucide-react';
import Link from 'next/link';

import { EmptyState, ErrorState, LoadingState } from '@/components/query-states';
import { browserApi } from '@/lib/browser-api';
import type { Appointment, BarberProfile, BarberService } from '@/lib/contracts';
import { errorMessage } from '@/lib/errors';

type AppointmentsResponse = {
  appointments: Appointment[];
  pagination: { total: number };
};

export default function DashboardPage(): React.ReactElement {
  const profile = useQuery({
    queryKey: ['barber-profile'],
    queryFn: () => browserApi.get<BarberProfile>('/barbers/me'),
    retry: false,
  });
  const services = useQuery({
    queryKey: ['services'],
    queryFn: () =>
      browserApi.get<{ services: BarberService[]; total: number }>('/barbers/me/services'),
    enabled: profile.isSuccess,
  });
  const appointments = useQuery({
    queryKey: ['appointments', 'overview'],
    queryFn: () => browserApi.get<AppointmentsResponse>('/barbers/me/appointments?limit=5&page=1'),
    enabled: profile.isSuccess,
  });

  if (profile.isPending) {
    return <LoadingState />;
  }

  if (profile.error instanceof ApiError && profile.error.code === 'BARBER_PROFILE_NOT_FOUND') {
    return (
      <main className="page">
        <div className="page-header">
          <div>
            <h1>Welcome to your workspace</h1>
            <p>Start with the details clients need before you open your calendar.</p>
          </div>
        </div>
        <section className="panel">
          <EmptyState
            title="Your barber profile is ready to be shaped"
            detail="Add your business name, location, experience, and a short introduction."
            action={
              <Link className="button button-primary" href="/barber/dashboard/portfolio">
                <UserRoundPlus size={17} />
                Build portfolio
              </Link>
            }
          />
        </section>
      </main>
    );
  }

  if (profile.isError) {
    return (
      <main className="page">
        <section className="panel">
          <ErrorState message={errorMessage(profile.error)} />
        </section>
      </main>
    );
  }

  const nextAppointments = appointments.data?.appointments ?? [];
  const activeServices = services.data?.services.filter((service) => service.isActive).length ?? 0;
  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>{profile.data.businessName}</h1>
          <p>Here is the shape of your business today.</p>
        </div>
        <Link className="button button-secondary" href="/barber/dashboard/portfolio?view=preview">
          View public profile
        </Link>
      </div>
      <section className="stats-grid dashboard-summary-grid" aria-label="Business summary">
        <div className="stat">
          <div className="stat-icon">
            <CalendarCheck size={18} />
          </div>
          <div className="stat-value">{appointments.data?.pagination.total ?? 0}</div>
          <div className="stat-label">Appointments in view</div>
        </div>
        <div className="stat">
          <div className="stat-icon">
            <Scissors size={18} />
          </div>
          <div className="stat-value">{activeServices}</div>
          <div className="stat-label">Active services</div>
        </div>
        <div className="stat">
          <div className="stat-icon">
            <Star size={18} />
          </div>
          <div className="stat-value">{profile.data.averageRating.toFixed(1)}</div>
          <div className="stat-label">{profile.data.totalReviews} client reviews</div>
        </div>
      </section>
      <section className="two-column">
        <div className="panel">
          <div className="panel-header">
            <h2>Upcoming appointments</h2>
            <Link className="text-link" href="/barber/dashboard/appointments">
              View all
            </Link>
          </div>
          {appointments.isPending ? (
            <LoadingState />
          ) : nextAppointments.length === 0 ? (
            <EmptyState title="A clear book" detail="Upcoming appointments will appear here." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Service</th>
                    <th>Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {nextAppointments.map((appointment) => (
                    <tr key={appointment.id}>
                      <td>
                        {appointment.client.firstName} {appointment.client.lastName}
                      </td>
                      <td>{appointment.service.name}</td>
                      <td>{new Date(appointment.scheduledAt).toLocaleString()}</td>
                      <td>
                        <span className="badge">{appointment.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="panel">
          <div className="panel-header">
            <h2>Workspace health</h2>
          </div>
          <div className="panel-body form-stack">
            <div>
              <strong>Profile</strong>
              <p className="subtitle" style={{ margin: '5px 0 0' }}>
                {profile.data.isVerified ? 'Verified business profile' : 'Verification pending'}
              </p>
            </div>
            <div>
              <strong>Plan</strong>
              <p className="subtitle" style={{ margin: '5px 0 0' }}>
                {profile.data.subscriptionTier} plan · {activeServices} active services
              </p>
            </div>
            <Link className="button button-secondary" href="/barber/dashboard/availability">
              Set availability
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
