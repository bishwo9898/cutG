import { randomUUID } from 'crypto';

import { faker } from '@faker-js/faker';
import type { Knex } from 'knex';

type BarberSeed = {
  userId: string;
  profileId: string;
  businessName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  zipCode: string;
  address: string;
  latitude: number;
  longitude: number;
  tier: 'FREE' | 'BASIC' | 'PREMIUM';
  averageRating: number;
  totalReviews: number;
  totalClients: number;
  services: Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    durationMinutes: number;
    category: string;
  }>;
  slotCount: number;
};

type ClientSeed = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type SlotSeed = {
  id: string;
  barberId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: 'AVAILABLE' | 'BOOKED' | 'BLOCKED';
};

type AppointmentSeed = {
  id: string;
  clientId: string;
  barberId: string;
  serviceId: string;
  availabilitySlotId: string;
  scheduledAt: Date;
  durationMinutes: number;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  paymentStatus: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  locationAddress: string;
  locationLatitude: number;
  locationLongitude: number;
  priceQuoted: number;
  pricePaid: number | null;
  clientNotes: string | null;
  barberNotes: string | null;
  cancellationReason: string | null;
  confirmedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
};

const PASSWORD_HASH = '$2b$12$1CmZfZG/zvDqal.R7w/rOOhKrDV0BSfA7LOtUdMy29tn1RvQytqRW';
const scheduleTemplates = [
  { days: [1, 2, 3, 4, 5], start: 9 * 60, end: 17 * 60, duration: 30 },
  { days: [2, 3, 4, 5, 6], start: 10 * 60, end: 18 * 60, duration: 30 },
  { days: [3, 4, 5, 6, 7], start: 11 * 60, end: 19 * 60, duration: 45 },
];

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

const toDateAtTime = (date: Date, time: string): Date => {
  const [hours, minutes] = time.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours ?? 9, minutes ?? 0, 0, 0);
  return result;
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const requireAt = <T>(items: readonly T[], index: number, label: string): T => {
  const item = items[index % items.length];

  if (item === undefined) {
    throw new Error(`Missing seed item for ${label}`);
  }

  return item;
};

const barberSeeds: BarberSeed[] = [
  {
    userId: randomUUID(),
    profileId: randomUUID(),
    businessName: "Marcus's Barber Shop",
    firstName: 'Marcus',
    lastName: 'Reed',
    email: 'barber1@example.com',
    phone: '+15550001001',
    city: 'Atlanta',
    state: 'GA',
    zipCode: '30303',
    address: '122 Edgewood Ave NE, Atlanta, GA',
    latitude: 33.7547,
    longitude: -84.3863,
    tier: 'PREMIUM',
    averageRating: 5,
    totalReviews: 47,
    totalClients: 120,
    services: [
      {
        id: randomUUID(),
        name: 'Classic Cut',
        description: 'Clean scissor and clipper cut with neckline finish.',
        price: 15,
        durationMinutes: 30,
        category: 'haircut',
      },
      {
        id: randomUUID(),
        name: 'Fade',
        description: 'Precision fade with blend, lineup, and styling.',
        price: 18,
        durationMinutes: 40,
        category: 'haircut',
      },
      {
        id: randomUUID(),
        name: 'Beard Trim',
        description: 'Shape, trim, and hot towel finish.',
        price: 12,
        durationMinutes: 20,
        category: 'beard',
      },
      {
        id: randomUUID(),
        name: 'Full Service',
        description: 'Haircut, beard trim, shave, and finish.',
        price: 25,
        durationMinutes: 60,
        category: 'combo',
      },
    ],
    slotCount: 20,
  },
  {
    userId: randomUUID(),
    profileId: randomUUID(),
    businessName: 'Urban Cuts Barbershop',
    firstName: 'Dante',
    lastName: 'Brooks',
    email: 'barber2@example.com',
    phone: '+15550001002',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60616',
    address: '2101 S Michigan Ave, Chicago, IL',
    latitude: 41.8532,
    longitude: -87.6248,
    tier: 'BASIC',
    averageRating: 4.8,
    totalReviews: 32,
    totalClients: 85,
    services: [
      {
        id: randomUUID(),
        name: 'Haircut',
        description: 'Modern haircut with clean finish.',
        price: 16,
        durationMinutes: 35,
        category: 'haircut',
      },
      {
        id: randomUUID(),
        name: 'Line-up',
        description: 'Sharp hairline, temples, and neckline detail.',
        price: 10,
        durationMinutes: 15,
        category: 'haircut',
      },
      {
        id: randomUUID(),
        name: 'Shave',
        description: 'Straight razor shave with towel service.',
        price: 20,
        durationMinutes: 35,
        category: 'shave',
      },
    ],
    slotCount: 15,
  },
  {
    userId: randomUUID(),
    profileId: randomUUID(),
    businessName: 'Classic Barber Studio',
    firstName: 'Elijah',
    lastName: 'Stone',
    email: 'barber3@example.com',
    phone: '+15550001003',
    city: 'Austin',
    state: 'TX',
    zipCode: '78702',
    address: '1400 E 6th St, Austin, TX',
    latitude: 30.2637,
    longitude: -97.7284,
    tier: 'FREE',
    averageRating: 4.5,
    totalReviews: 18,
    totalClients: 40,
    services: [
      {
        id: randomUUID(),
        name: 'Haircut',
        description: 'Reliable everyday cut.',
        price: 12,
        durationMinutes: 30,
        category: 'haircut',
      },
      {
        id: randomUUID(),
        name: 'Quick Trim',
        description: 'Fast cleanup for edges and shape.',
        price: 8,
        durationMinutes: 15,
        category: 'haircut',
      },
    ],
    slotCount: 10,
  },
];

const namedClients: Array<Pick<ClientSeed, 'firstName' | 'lastName'>> = [
  { firstName: 'John', lastName: 'Client' },
  { firstName: 'Sarah', lastName: 'Johnson' },
];

const buildClients = (): ClientSeed[] => {
  const generatedClients = Array.from(
    { length: 10 },
    (): Pick<ClientSeed, 'firstName' | 'lastName'> => ({
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
    }),
  );

  return [...namedClients, ...generatedClients].map((client, index): ClientSeed => ({
    id: randomUUID(),
    firstName: client.firstName,
    lastName: client.lastName,
    email:
      index === 0
        ? 'client1@example.com'
        : `${client.firstName}.${client.lastName}.${index}@clients.cutg.test`.toLowerCase(),
    phone: `+15550002${String(index).padStart(3, '0')}`,
  }));
};

const buildSlots = (): SlotSeed[] => {
  const toTime = (minutes: number): string =>
    `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

  return barberSeeds.flatMap((barber, barberIndex): SlotSeed[] => {
    const template = requireAt(scheduleTemplates, barberIndex, 'schedule template');
    return Array.from({ length: 14 }, (_, dayOffset) => addDays(new Date(), dayOffset - 6)).flatMap(
      (slotDate): SlotSeed[] => {
        const day = slotDate.getDay() === 0 ? 7 : slotDate.getDay();
        if (!template.days.includes(day)) return [];
        const slots: SlotSeed[] = [];
        for (
          let start = template.start;
          start + template.duration <= template.end;
          start += template.duration
        ) {
          slots.push({
            id: randomUUID(),
            barberId: barber.profileId,
            slotDate: isoDate(slotDate),
            startTime: toTime(start),
            endTime: toTime(start + template.duration),
            durationMinutes: template.duration,
            status: 'AVAILABLE',
          });
        }
        return slots;
      },
    );
  });
};

const buildAppointments = (clients: ClientSeed[], slots: SlotSeed[]): AppointmentSeed[] => {
  const statuses: AppointmentSeed['status'][] = [
    'COMPLETED',
    'COMPLETED',
    'COMPLETED',
    'COMPLETED',
    'COMPLETED',
    'COMPLETED',
    'COMPLETED',
    'COMPLETED',
    'CONFIRMED',
    'CONFIRMED',
    'CONFIRMED',
    'CONFIRMED',
    'CONFIRMED',
    'PENDING',
    'PENDING',
    'PENDING',
    'PENDING',
    'CANCELLED',
    'CANCELLED',
    'NO_SHOW',
  ];

  return statuses.map((status, index): AppointmentSeed => {
    const barber = requireAt(barberSeeds, index, 'appointment barber');
    const client =
      index < 5 || (status === 'PENDING' && barber.email === 'barber1@example.com')
        ? requireAt(clients, 0, 'John Client')
        : requireAt(clients, index - 4, 'appointment client');
    const service = requireAt(barber.services, index, 'appointment service');
    const slot = requireAt(
      slots.filter((candidate) => candidate.barberId === barber.profileId),
      index,
      'appointment slot',
    );
    const scheduledAt = toDateAtTime(new Date(`${slot.slotDate}T12:00:00`), slot.startTime);
    const isCompleted = status === 'COMPLETED';
    const isCancelled = status === 'CANCELLED';
    const paymentStatus: AppointmentSeed['paymentStatus'] =
      status === 'PENDING'
        ? 'PENDING'
        : isCompleted
          ? 'SUCCEEDED'
          : status === 'CANCELLED'
            ? 'REFUNDED'
            : 'PENDING';

    slot.status = status === 'CANCELLED' ? 'AVAILABLE' : 'BOOKED';

    return {
      id: randomUUID(),
      clientId: client.id,
      barberId: barber.profileId,
      serviceId: service.id,
      availabilitySlotId: slot.id,
      scheduledAt,
      durationMinutes: service.durationMinutes,
      status,
      paymentStatus,
      locationAddress: barber.address,
      locationLatitude: barber.latitude,
      locationLongitude: barber.longitude,
      priceQuoted: service.price,
      pricePaid: isCompleted ? service.price : null,
      clientNotes:
        status === 'PENDING' ? 'Prefers a low-maintenance style if the schedule allows.' : null,
      barberNotes: isCompleted
        ? 'Client left satisfied; style notes recorded for next visit.'
        : null,
      cancellationReason: isCancelled ? 'Schedule conflict reported by client.' : null,
      confirmedAt: status === 'CONFIRMED' || isCompleted ? addDays(scheduledAt, -1) : null,
      completedAt: isCompleted ? addDays(scheduledAt, 0) : null,
      cancelledAt: isCancelled ? addDays(scheduledAt, -1) : null,
    };
  });
};

export async function seed(knex: Knex): Promise<void> {
  faker.seed(20260707);

  await knex('notifications').del();
  await knex('client_saved_barbers').del();
  await knex('reviews').del();
  await knex('payments').del();
  await knex('payout_batches').del();
  await knex('subscription_events').del();
  await knex('subscriptions').del();
  await knex('barber_blocked_dates').del();
  await knex('barber_schedules').del();
  await knex('availability_slots').update({ appointment_id: null });
  await knex('appointments').del();
  await knex('availability_slots').del();
  await knex('services').del();
  await knex('barber_profiles').del();
  await knex('users').del();

  const clients = buildClients();
  const slots = buildSlots();
  const appointments = buildAppointments(clients, slots);
  const appointmentBySlotId = new Map(
    appointments.map((appointment) => [appointment.availabilitySlotId, appointment]),
  );

  await knex('users').insert([
    ...barberSeeds.map((barber) => ({
      id: barber.userId,
      email: barber.email,
      password_hash: PASSWORD_HASH,
      phone: barber.phone,
      first_name: barber.firstName,
      last_name: barber.lastName,
      user_type: 'BARBER',
      is_active: true,
      email_verified: true,
      email_verified_at: new Date(),
      metadata: { seeded: true, persona: 'barber' },
    })),
    ...clients.map((client) => ({
      id: client.id,
      email: client.email,
      password_hash: PASSWORD_HASH,
      phone: client.phone,
      first_name: client.firstName,
      last_name: client.lastName,
      user_type: 'CLIENT',
      is_active: true,
      email_verified: true,
      email_verified_at: new Date(),
      metadata: { seeded: true, persona: 'client' },
    })),
  ]);

  await knex('barber_profiles').insert(
    barberSeeds.map((barber) => ({
      id: barber.profileId,
      user_id: barber.userId,
      business_name: barber.businessName,
      bio: faker.company.catchPhrase(),
      years_of_experience: faker.number.int({ min: 3, max: 18 }),
      average_rating: barber.averageRating,
      total_reviews: barber.totalReviews,
      total_clients: barber.totalClients,
      latitude: barber.latitude,
      longitude: barber.longitude,
      address: barber.address,
      city: barber.city,
      state: barber.state,
      zip_code: barber.zipCode,
      profile_photo_url: `https://images.cutg.test/${barber.profileId}.jpg`,
      profile_photo_key: `barbers/${barber.profileId}/profile.jpg`,
      subscription_tier: barber.tier,
      subscription_valid_until: addDays(new Date(), 30),
      stripe_account_id:
        barber.email === 'barber1@example.com'
          ? 'acct_test_barber1'
          : barber.email === 'barber2@example.com'
            ? 'acct_test_barber2'
            : null,
      stripe_onboarding_complete: barber.email === 'barber1@example.com',
      stripe_charges_enabled: barber.email === 'barber1@example.com',
      stripe_payouts_enabled: barber.email === 'barber1@example.com',
      is_verified: barber.tier !== 'FREE',
      verified_at: barber.tier !== 'FREE' ? new Date() : null,
      metadata: { seeded: true, specialties: ['fades', 'lineups', 'classic cuts'] },
    })),
  );

  await knex('barber_schedules').insert(
    barberSeeds.flatMap((barber, index) => {
      const template = requireAt(scheduleTemplates, index, 'schedule template');
      return template.days.map((day) => ({
        id: randomUUID(),
        barber_id: barber.profileId,
        day_of_week: day,
        start_time: `${String(Math.floor(template.start / 60)).padStart(2, '0')}:00`,
        end_time: `${String(Math.floor(template.end / 60)).padStart(2, '0')}:00`,
        slot_duration_minutes: template.duration,
        is_active: true,
      }));
    }),
  );

  await knex('barber_blocked_dates').insert(
    barberSeeds.map((barber, index) => ({
      id: randomUUID(),
      barber_id: barber.profileId,
      blocked_date: isoDate(addDays(new Date(), 21 + index)),
      reason: 'Seeded future day off',
    })),
  );

  await knex('services').insert(
    barberSeeds.flatMap((barber) =>
      barber.services.map((service) => ({
        id: service.id,
        barber_id: barber.profileId,
        name: service.name,
        description: service.description,
        price: service.price,
        duration_minutes: service.durationMinutes,
        category: service.category,
        is_active: true,
        metadata: { seeded: true },
      })),
    ),
  );

  await knex('availability_slots').insert(
    slots.map((slot) => ({
      id: slot.id,
      barber_id: slot.barberId,
      slot_date: slot.slotDate,
      start_time: slot.startTime,
      end_time: slot.endTime,
      duration_minutes: slot.durationMinutes,
      status: slot.status,
    })),
  );

  await knex('appointments').insert(
    appointments.map((appointment) => ({
      id: appointment.id,
      client_id: appointment.clientId,
      barber_id: appointment.barberId,
      service_id: appointment.serviceId,
      availability_slot_id: appointment.availabilitySlotId,
      scheduled_at: appointment.scheduledAt,
      duration_minutes: appointment.durationMinutes,
      status: appointment.status,
      payment_status: appointment.paymentStatus,
      location_address: appointment.locationAddress,
      location_latitude: appointment.locationLatitude,
      location_longitude: appointment.locationLongitude,
      price_quoted: appointment.priceQuoted,
      price_paid: appointment.pricePaid,
      client_notes: appointment.clientNotes,
      barber_notes: appointment.barberNotes,
      cancellation_reason: appointment.cancellationReason,
      confirmed_at: appointment.confirmedAt,
      completed_at: appointment.completedAt,
      cancelled_at: appointment.cancelledAt,
    })),
  );

  await Promise.all(
    slots
      .filter((slot) => slot.status === 'BOOKED')
      .map(async (slot): Promise<void> => {
        const appointment = appointmentBySlotId.get(slot.id);
        if (appointment === undefined) {
          return;
        }

        await knex('availability_slots')
          .where({ id: slot.id })
          .update({ appointment_id: appointment.id, status: slot.status });
      }),
  );

  const now = new Date();
  await knex('subscriptions').insert(
    barberSeeds.map((barber) => ({
      id: randomUUID(),
      barber_id: barber.profileId,
      tier: barber.tier,
      status: 'ACTIVE',
      stripe_customer_id:
        barber.tier === 'FREE'
          ? null
          : `cus_seed_${barber.profileId.replaceAll('-', '').slice(0, 12)}`,
      stripe_subscription_id:
        barber.tier === 'FREE'
          ? null
          : `sub_seed_${barber.profileId.replaceAll('-', '').slice(0, 12)}`,
      billing_interval: barber.tier === 'FREE' ? null : 'month',
      billing_cycle_start: addDays(now, -15),
      billing_cycle_end: addDays(now, 15),
      current_period_start: addDays(now, -15),
      current_period_end: addDays(now, 15),
      renewal_date: addDays(now, 16),
      auto_renew: true,
      cancel_at_period_end: false,
      features: {
        max_services: barber.tier === 'FREE' ? 5 : barber.tier === 'BASIC' ? 15 : 100,
        max_clients: barber.tier === 'FREE' ? 100 : barber.tier === 'BASIC' ? 500 : 5000,
        advanced_analytics: barber.tier !== 'FREE',
        ai_recommendations: barber.tier === 'PREMIUM',
      },
    })),
  );

  const payableAppointments = [
    ...appointments.filter((appointment) => appointment.status === 'COMPLETED'),
    ...appointments.filter((appointment) => appointment.status === 'PENDING').slice(0, 2),
  ];
  const barber1CompletedPayments = payableAppointments.filter(
    (appointment) =>
      appointment.status === 'COMPLETED' &&
      appointment.barberId === requireAt(barberSeeds, 0, 'barber1').profileId,
  );
  const barber1PayoutBatchId = randomUUID();

  await knex('payout_batches').insert({
    id: barber1PayoutBatchId,
    barber_id: requireAt(barberSeeds, 0, 'barber1').profileId,
    stripe_transfer_id: 'tr_seed_barber1_batch1',
    amount_cents: barber1CompletedPayments.reduce(
      (sum, appointment) => sum + Math.round(appointment.priceQuoted * 100 * 0.9),
      0,
    ),
    currency: 'usd',
    status: 'paid',
    appointment_count: 5,
    period_start: isoDate(addDays(now, -14)),
    period_end: isoDate(now),
    paid_at: addDays(now, -1),
  });

  await knex('payments').insert(
    payableAppointments.map((appointment, index) => ({
      amount_cents: Math.round(appointment.priceQuoted * 100),
      platform_fee_cents: Math.round(appointment.priceQuoted * 100 * 0.1),
      barber_payout_cents:
        Math.round(appointment.priceQuoted * 100) - Math.round(appointment.priceQuoted * 100 * 0.1),
      id: randomUUID(),
      appointment_id: appointment.id,
      client_id: appointment.clientId,
      barber_id: appointment.barberId,
      currency: 'usd',
      stripe_payment_intent_id: `pi_seed_${String(index).padStart(4, '0')}`,
      stripe_charge_id:
        appointment.paymentStatus === 'SUCCEEDED'
          ? `ch_seed_${String(index).padStart(4, '0')}`
          : null,
      status: appointment.paymentStatus,
      captured_at: appointment.paymentStatus === 'SUCCEEDED' ? appointment.completedAt : null,
      payout_batch_id:
        appointment.status === 'COMPLETED' &&
        appointment.barberId === requireAt(barberSeeds, 0, 'barber1').profileId
          ? barber1PayoutBatchId
          : null,
      metadata: { seeded: true },
    })),
  );

  const completedAppointments = appointments.filter(
    (appointment) => appointment.status === 'COMPLETED',
  );
  const ratings = [5, 4, 4, 4, 3, 3, 2, 5];

  await knex('reviews').insert(
    completedAppointments.map((appointment, index) => ({
      id: randomUUID(),
      appointment_id: appointment.id,
      client_id: appointment.clientId,
      barber_id: appointment.barberId,
      rating: requireAt(ratings, index, 'review rating'),
      title: faker.helpers.arrayElement([
        'Great attention to detail',
        'Exactly what I needed',
        'Clean cut and professional',
        'Easy booking experience',
      ]),
      comment: faker.lorem.sentences({ min: 1, max: 2 }),
      is_verified_appointment: true,
      helpful_count: faker.number.int({ min: 0, max: 12 }),
    })),
  );

  await knex.raw(`
    UPDATE barber_profiles bp SET
      average_rating = COALESCE(review_summary.average_rating, 0),
      total_reviews = COALESCE(review_summary.total_reviews, 0),
      updated_at = CURRENT_TIMESTAMP
    FROM (
      SELECT
        barber_id,
        ROUND(AVG(rating)::numeric, 2) AS average_rating,
        COUNT(*)::int AS total_reviews
      FROM reviews
      GROUP BY barber_id
    ) review_summary
    WHERE bp.id = review_summary.barber_id;
  `);

  await knex('client_saved_barbers').insert([
    {
      id: randomUUID(),
      client_id: requireAt(clients, 0, 'saved barber client').id,
      barber_id: requireAt(barberSeeds, 0, 'saved barber').profileId,
    },
    {
      id: randomUUID(),
      client_id: requireAt(clients, 1, 'saved barber client').id,
      barber_id: requireAt(barberSeeds, 1, 'saved barber').profileId,
    },
  ]);

  await knex('notifications').insert(
    appointments.slice(0, 12).map((appointment, index) => ({
      id: randomUUID(),
      user_id: appointment.clientId,
      type: appointment.status === 'CONFIRMED' ? 'APPOINTMENT_CONFIRMED' : 'REVIEW_REQUEST',
      title: appointment.status === 'CONFIRMED' ? 'Appointment confirmed' : 'How was your visit?',
      message:
        appointment.status === 'CONFIRMED'
          ? 'Your barber confirmed the appointment.'
          : 'Share a quick review to help other clients choose confidently.',
      related_data: { appointmentId: appointment.id },
      is_read: index % 3 === 0,
      read_at: index % 3 === 0 ? new Date() : null,
      sent_via_email: true,
      sent_via_sms: index % 2 === 0,
      sent_via_push: false,
      scheduled_for: null,
      sent_at: new Date(),
    })),
  );
}
