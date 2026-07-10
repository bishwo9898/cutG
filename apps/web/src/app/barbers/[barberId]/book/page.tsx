'use client';

import { barberDiscoveryApi, clientApi } from '@barber-saas/api-client';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { BookingSteps, SlotPicker } from '@/components/client-ui';
import { Notice } from '@/components/notice';
import { useUser } from '@/hooks/use-user';
import { browserApi } from '@/lib/browser-api';
import type { ClientAppointment, PublicService, PublicSlot } from '@/lib/contracts';

type Profile = { id: string; businessName: string; city: string | null; state: string | null };
type Services = { services: PublicService[] };
type Slots = { slots: PublicSlot[] };

export default function BookBarberPage(): React.ReactElement {
  const params = useParams<{ barberId: string }>();
  const router = useRouter();
  const barberId = params.barberId;
  const [service, setService] = useState<PublicService | null>(null);
  const [slot, setSlot] = useState<PublicSlot | null>(null);
  const [clientNotes, setClientNotes] = useState('');
  const { data: user } = useUser();

  const profile = useQuery({
    queryKey: ['public-barber-book', barberId],
    queryFn: () => barberDiscoveryApi.getProfile<Profile>(browserApi, barberId),
  });
  const services = useQuery({
    queryKey: ['public-barber-book-services', barberId],
    queryFn: () => barberDiscoveryApi.getServices<Services>(browserApi, barberId),
  });
  const slots = useQuery({
    queryKey: ['public-barber-book-slots', barberId],
    queryFn: () => barberDiscoveryApi.getSlots<Slots>(browserApi, barberId, { days: 14 }),
  });
  const filteredSlots = useMemo(() => {
    if (service === null) return [];
    return (slots.data?.slots ?? []).filter((candidate) => {
      const start = new Date(`${candidate.date}T${candidate.startTime}:00`).getTime();
      const end = new Date(`${candidate.date}T${candidate.endTime}:00`).getTime();
      return candidate.isAvailable && (end - start) / 60000 >= service.durationMinutes;
    });
  }, [service, slots.data?.slots]);

  const booking = useMutation({
    mutationFn: () =>
      clientApi.bookAppointment<ClientAppointment>(browserApi, {
        barberId,
        serviceId: service?.id,
        availabilitySlotId: slot?.id,
        clientNotes: clientNotes.trim() || undefined,
      }),
    onSuccess: (appointment) => {
      router.push(`/appointments/${appointment.id}`);
    },
  });

  const step: 1 | 2 | 3 = service === null ? 1 : slot === null ? 2 : 3;

  return (
    <main className="market-page">
      <header className="market-nav">
        <Link className="brand-lockup dark" href="/">
          <span className="brand-mark">cG</span>
          cutG
        </Link>
        <nav>
          <Link href={`/barbers/${barberId}`}>Profile</Link>
        </nav>
      </header>
      <section className="booking-shell">
        <div className="section-title">
          <div>
            <p className="eyebrow">Book appointment</p>
            <h1>{profile.data?.businessName ?? 'Barber'}</h1>
          </div>
        </div>
        <BookingSteps currentStep={step} />
        {user?.userType !== 'CLIENT' && (
          <Notice>
            Create or sign into a free client account before confirming your appointment. You can
            still choose a service and slot first.
          </Notice>
        )}
        <div className="booking-grid">
          <section>
            <h2>1. Choose a service</h2>
            <div className="list-stack">
              {(services.data?.services ?? []).map((item) => (
                <button
                  className={`list-row selectable${service?.id === item.id ? ' is-selected' : ''}`}
                  key={item.id}
                  onClick={() => {
                    setService(item);
                    setSlot(null);
                  }}
                  type="button"
                >
                  <span>
                    <strong>{item.name}</strong>
                    <span className="muted">{item.durationMinutes} min</span>
                  </span>
                  <strong>${item.price.toFixed(2)}</strong>
                </button>
              ))}
            </div>
          </section>
          <section>
            <h2>2. Pick a time</h2>
            {service === null ? (
              <p className="muted">Choose a service first.</p>
            ) : (
              <SlotPicker slots={filteredSlots} selectedId={slot?.id} onSelect={setSlot} />
            )}
          </section>
          <section>
            <h2>3. Confirm</h2>
            {slot === null || service === null ? (
              <p className="muted">Your summary will appear after choosing a service and slot.</p>
            ) : (
              <div className="summary-panel">
                <p>
                  <strong>{service.name}</strong> at {profile.data?.businessName}
                </p>
                <p>
                  {slot.date} at {slot.startTime}
                </p>
                <p>${service.price.toFixed(2)} - Pay at the shop</p>
                <textarea
                  className="textarea"
                  placeholder="Optional notes"
                  value={clientNotes}
                  onChange={(event) => setClientNotes(event.target.value)}
                />
                {user?.userType === 'CLIENT' ? (
                  <button
                    className="button button-primary button-full"
                    disabled={booking.isPending}
                    onClick={() => booking.mutate()}
                    type="button"
                  >
                    {booking.isPending ? 'Booking...' : 'Confirm appointment'}
                  </button>
                ) : (
                  <Link className="button button-primary button-full" href="/login">
                    Sign in to book
                  </Link>
                )}
                {booking.error instanceof Error && <Notice>{booking.error.message}</Notice>}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
