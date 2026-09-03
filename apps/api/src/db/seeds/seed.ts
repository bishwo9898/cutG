import { randomUUID } from 'crypto';

import { createClerkClient } from '@clerk/backend';
import type { Knex } from 'knex';

import { env } from '../../config/env';

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
  isTravelBuffer?: boolean;
  travelBufferFor?: string | null;
  travelBufferKind?: 'OUTBOUND' | 'RETURN' | null;
};

type AppointmentSeed = {
  id: string;
  clientId: string;
  barberId: string;
  serviceId: string;
  availabilitySlotId: string;
  scheduledAt: Date;
  /**
   * The wall clock the slot publishes, as text. `scheduledAt` is a local Date and is only used
   * for deriving nearby instants (confirmedAt); writing it straight into the timestamptz column
   * re-encoded it through the seeding machine's zone, so an 11:00 slot landed at 15:00+00 and the
   * barber's calendar showed the appointment four hours from the slot it belongs to.
   */
  scheduledWallClock: string;
  durationMinutes: number;
  status: 'PENDING' | 'CONFIRMED' | 'ON_THE_WAY' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
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
  barberDepartedAt: Date | null;
  isMobileService: boolean;
  serviceAddressLine1: string | null;
  serviceAddressCity: string | null;
  serviceAddressState: string | null;
  serviceAddressZip: string | null;
  serviceAddressFormatted: string | null;
  serviceAddressSource: 'google' | 'coordinate_fallback' | null;
  serviceAddressIsApproximate: boolean | null;
  serviceLatitude: number | null;
  serviceLongitude: number | null;
  travelFeeCents: number;
  estimatedTravelMinutes: number | null;
  distanceMiles: number | null;
};

const TEST_BARBER_EMAIL = 'barber.test@example.com';
const TEST_CLIENT_EMAIL = 'client.test@example.com';
// Keep this in sync with the credentials shown in the local UI, smoke tests, and setup docs.
// `ensureClerkUser` reapplies it to existing Clerk identities on every seed run.
//
// It must also survive Clerk's breached-password check. `skipPasswordChecks` only applies when the
// password is *written*, so an obvious value like "password123" seeds without complaint and then
// fails at sign in with "Password has been found in an online data breach" — the seeded accounts
// become unusable while looking perfectly seeded. Keep this off the common-password lists.
export const SEED_TEST_PASSWORD = 'CutgTest2026!';
const LEGACY_SEED_EMAILS = [
  'barber1@example.com',
  'barber2@example.com',
  'barber3@example.com',
  'client1@example.com',
  'client2@example.com',
];
const SEED_EMAILS = [TEST_BARBER_EMAIL, TEST_CLIENT_EMAIL, ...LEGACY_SEED_EMAILS];

const scheduleTemplates = [{ days: [1, 2, 3, 4, 5], start: 9 * 60, end: 17 * 60, duration: 30 }];

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

/**
 * Creates (or reuses) a real Clerk identity for a seeded test account, so it can actually sign in
 * through the app rather than just existing as a local database row. `internalUserId` is written
 * back to Clerk's publicMetadata immediately, matching what POST /auth/sync does for a normal
 * sign-up, so no first-request sync round trip is needed for these accounts.
 */
const ensureClerkUser = async (params: {
  email: string;
  firstName: string;
  lastName: string;
  userType: 'BARBER' | 'CLIENT';
  internalUserId: string;
}): Promise<string> => {
  const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
  const publicMetadata = { userType: params.userType, internalUserId: params.internalUserId };
  const existing = await clerkClient.users.getUserList({ emailAddress: [params.email] });
  const existingUser = existing.data[0];

  if (existingUser !== undefined) {
    // Reset the password too. The Clerk account outlives any single seed run, so without this the
    // documented SEED_TEST_PASSWORD silently stops being the way in as soon as it is changed here
    // or in Clerk, and re-seeding would not put it back.
    await clerkClient.users.updateUser(existingUser.id, {
      password: SEED_TEST_PASSWORD,
      skipPasswordChecks: true,
    });
    await clerkClient.users.updateUserMetadata(existingUser.id, { publicMetadata });
    return existingUser.id;
  }

  const created = await clerkClient.users.createUser({
    emailAddress: [params.email],
    password: SEED_TEST_PASSWORD,
    firstName: params.firstName,
    lastName: params.lastName,
    publicMetadata,
  });

  return created.id;
};

const barberSeeds: BarberSeed[] = [
  {
    userId: randomUUID(),
    profileId: randomUUID(),
    businessName: 'Barber Test Studio',
    firstName: 'Barber',
    lastName: 'Test',
    email: TEST_BARBER_EMAIL,
    phone: '+15550001001',
    city: 'Danville',
    state: 'KY',
    zipCode: '40422',
    address: '120 N 3rd St, Danville, KY',
    latitude: 37.6467,
    longitude: -84.7729,
    tier: 'PREMIUM',
    averageRating: 0,
    totalReviews: 0,
    totalClients: 0,
    services: [
      {
        id: randomUUID(),
        name: 'Test Classic Cut',
        description: 'Clean scissor and clipper cut with neckline finish.',
        price: 15,
        durationMinutes: 30,
        category: 'haircut',
      },
      {
        id: randomUUID(),
        name: 'Test Fade',
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
        name: 'Test Full Service',
        description: 'Haircut, beard trim, shave, and finish.',
        price: 25,
        durationMinutes: 60,
        category: 'combo',
      },
    ],
    slotCount: 20,
  },
];

const buildClients = (): ClientSeed[] => {
  return [
    {
      id: randomUUID(),
      firstName: 'Client',
      lastName: 'Test',
      email: TEST_CLIENT_EMAIL,
      phone: '+15550002001',
    },
  ];
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
  const barber = requireAt(barberSeeds, 0, 'test barber');
  const client = requireAt(clients, 0, 'test client');
  const service = requireAt(barber.services, 0, 'test service');
  const appointmentId = randomUUID();
  const barberSlots = slots.filter((candidate) => candidate.barberId === barber.profileId);
  const slot = barberSlots.find((candidate) => {
    if (candidate.slotDate <= isoDate(new Date())) return false;
    if (candidate.startTime !== '11:00') return false;

    const outboundBuffer = barberSlots.find(
      (buffer) => buffer.slotDate === candidate.slotDate && buffer.endTime === candidate.startTime,
    );
    const returnBuffer = barberSlots.find(
      (buffer) => buffer.slotDate === candidate.slotDate && buffer.startTime === candidate.endTime,
    );

    return outboundBuffer !== undefined && returnBuffer !== undefined;
  });

  if (slot === undefined) {
    throw new Error('Unable to find a seeded mobile appointment slot with travel buffers.');
  }

  const outboundBuffer = barberSlots.find(
    (candidate) => candidate.slotDate === slot.slotDate && candidate.endTime === slot.startTime,
  );
  const returnBuffer = barberSlots.find(
    (candidate) => candidate.slotDate === slot.slotDate && candidate.startTime === slot.endTime,
  );

  if (outboundBuffer === undefined || returnBuffer === undefined) {
    throw new Error('Unable to seed outbound and return travel buffers.');
  }

  slot.status = 'BOOKED';
  outboundBuffer.status = 'BLOCKED';
  outboundBuffer.isTravelBuffer = true;
  outboundBuffer.travelBufferFor = appointmentId;
  outboundBuffer.travelBufferKind = 'OUTBOUND';
  returnBuffer.status = 'BLOCKED';
  returnBuffer.isTravelBuffer = true;
  returnBuffer.travelBufferFor = appointmentId;
  returnBuffer.travelBufferKind = 'RETURN';

  const scheduledAt = toDateAtTime(new Date(`${slot.slotDate}T12:00:00`), slot.startTime);
  const scheduledWallClock = `${slot.slotDate}T${slot.startTime}:00`;

  return [
    {
      id: appointmentId,
      clientId: client.id,
      barberId: barber.profileId,
      serviceId: service.id,
      availabilitySlotId: slot.id,
      scheduledAt,
      scheduledWallClock,
      durationMinutes: service.durationMinutes,
      status: 'CONFIRMED',
      paymentStatus: 'PENDING',
      locationAddress: '212 W Main St, Danville, KY 40422',
      locationLatitude: 37.6454,
      locationLongitude: -84.7739,
      priceQuoted: service.price,
      pricePaid: null,
      clientNotes: 'Seeded mobile appointment for testing Start journey.',
      barberNotes: null,
      cancellationReason: null,
      confirmedAt: addDays(scheduledAt, -1),
      completedAt: null,
      cancelledAt: null,
      barberDepartedAt: null,
      isMobileService: true,
      serviceAddressLine1: '212 W Main St',
      serviceAddressCity: 'Danville',
      serviceAddressState: 'KY',
      serviceAddressZip: '40422',
      serviceAddressFormatted: '212 W Main St, Danville, KY 40422',
      serviceAddressSource: 'google',
      serviceAddressIsApproximate: false,
      serviceLatitude: 37.6454,
      serviceLongitude: -84.7739,
      travelFeeCents: 1500,
      estimatedTravelMinutes: 12,
      distanceMiles: 2.8,
    },
  ];
};

export async function seed(knex: Knex): Promise<void> {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_TEST_SEED !== 'true') {
    throw new Error(
      'Production test seeding is disabled. Set ALLOW_PRODUCTION_TEST_SEED=true for an intentional one-off seed run.',
    );
  }

  const isProductionSeed = process.env.NODE_ENV === 'production';
  const productionStripeAccountId = process.env.PRODUCTION_SEED_STRIPE_ACCOUNT_ID?.trim();
  const hasProductionStripeAccount =
    productionStripeAccountId !== undefined && productionStripeAccountId.startsWith('acct_');

  const seededUsers = await knex('users')
    .select<{ id: string }[]>('id')
    .whereIn('email', SEED_EMAILS)
    .orWhereRaw("metadata->>'seeded' = 'true'");
  const seededUserIds = seededUsers.map((user) => user.id);
  const seededBarbers = await knex('barber_profiles')
    .select<{ id: string }[]>('id')
    .whereIn('user_id', seededUserIds)
    .orWhereRaw("metadata->>'seeded' = 'true'");
  const seededBarberIds = seededBarbers.map((barber) => barber.id);
  const seededServices = await knex('services')
    .select<{ id: string }[]>('id')
    .whereIn('barber_id', seededBarberIds)
    .orWhereRaw("metadata->>'seeded' = 'true'");
  const seededServiceIds = seededServices.map((service) => service.id);
  const seededAppointments = await knex('appointments')
    .select<{ id: string }[]>('id')
    .whereIn('barber_id', seededBarberIds)
    .orWhereIn('client_id', seededUserIds)
    .orWhereIn('service_id', seededServiceIds);
  const seededAppointmentIds = seededAppointments.map((appointment) => appointment.id);

  await knex('appointments')
    .whereIn('id', seededAppointmentIds)
    .update({ style_reference_id: null });
  await knex('barber_location_pings').whereIn('appointment_id', seededAppointmentIds).del();
  await knex('ai_usage_events').whereIn('client_id', seededUserIds).del();
  await knex('hair_scan_sessions').whereIn('client_id', seededUserIds).del();
  await knex('client_hair_designs')
    .whereIn('client_id', seededUserIds)
    .orWhereIn('appointment_id', seededAppointmentIds)
    .del();
  await knex('notifications').whereIn('user_id', seededUserIds).del();
  await knex('client_addresses').whereIn('client_id', seededUserIds).del();
  await knex('mobile_barber_config').whereIn('barber_id', seededBarberIds).del();
  await knex('client_saved_barbers')
    .whereIn('client_id', seededUserIds)
    .orWhereIn('barber_id', seededBarberIds)
    .del();
  await knex('reviews')
    .whereIn('appointment_id', seededAppointmentIds)
    .orWhereIn('client_id', seededUserIds)
    .orWhereIn('barber_id', seededBarberIds)
    .del();
  await knex('payments')
    .whereIn('appointment_id', seededAppointmentIds)
    .orWhereIn('client_id', seededUserIds)
    .orWhereIn('barber_id', seededBarberIds)
    .del();
  await knex('payout_batches').whereIn('barber_id', seededBarberIds).del();
  await knex('subscription_events').whereIn('barber_id', seededBarberIds).del();
  await knex('subscriptions').whereIn('barber_id', seededBarberIds).del();
  await knex('barber_blocked_dates').whereIn('barber_id', seededBarberIds).del();
  await knex('barber_schedules').whereIn('barber_id', seededBarberIds).del();
  await knex('availability_slots')
    .whereIn('barber_id', seededBarberIds)
    .update({ appointment_id: null, travel_buffer_for: null });
  await knex('appointments').whereIn('id', seededAppointmentIds).del();
  await knex('availability_slots').whereIn('barber_id', seededBarberIds).del();
  await knex('services').whereIn('id', seededServiceIds).del();
  await knex('barber_profiles').whereIn('id', seededBarberIds).del();
  await knex('users').whereIn('id', seededUserIds).del();

  const clients = buildClients();
  const slots = buildSlots();
  const appointments = buildAppointments(clients, slots);
  const appointmentBySlotId = new Map(
    appointments.map((appointment) => [appointment.availabilitySlotId, appointment]),
  );

  const barberClerkIds = await Promise.all(
    barberSeeds.map((barber) =>
      ensureClerkUser({
        email: barber.email,
        firstName: barber.firstName,
        lastName: barber.lastName,
        userType: 'BARBER',
        internalUserId: barber.userId,
      }),
    ),
  );
  const clientClerkIds = await Promise.all(
    clients.map((client) =>
      ensureClerkUser({
        email: client.email,
        firstName: client.firstName,
        lastName: client.lastName,
        userType: 'CLIENT',
        internalUserId: client.id,
      }),
    ),
  );

  await knex('users').insert([
    ...barberSeeds.map((barber, index) => ({
      id: barber.userId,
      clerk_user_id: requireAt(barberClerkIds, index, 'barber Clerk id'),
      email: barber.email,
      phone: barber.phone,
      first_name: barber.firstName,
      last_name: barber.lastName,
      user_type: 'BARBER',
      is_active: true,
      email_verified: true,
      email_verified_at: new Date(),
      metadata: { seeded: true, persona: 'barber' },
    })),
    ...clients.map((client, index) => ({
      id: client.id,
      clerk_user_id: requireAt(clientClerkIds, index, 'client Clerk id'),
      email: client.email,
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
    barberSeeds.map((barber, index) => ({
      id: barber.profileId,
      user_id: barber.userId,
      business_name: barber.businessName,
      bio: 'Seeded premium barber for testing the full cutG shop, mobile, tracking, and payment flow.',
      years_of_experience: 8,
      average_rating: barber.averageRating,
      total_reviews: barber.totalReviews,
      total_clients: barber.totalClients,
      latitude: barber.latitude,
      longitude: barber.longitude,
      address: barber.address,
      city: barber.city,
      state: barber.state,
      zip_code: barber.zipCode,
      profile_photo_url: `/images/barbers/barber-${index + 1}.webp`,
      profile_photo_key: `barbers/barber-${index + 1}.webp`,
      subscription_tier: barber.tier,
      subscription_valid_until: addDays(new Date(), 30),
      stripe_account_id: isProductionSeed
        ? hasProductionStripeAccount
          ? productionStripeAccountId
          : null
        : 'acct_seed_barber_test_local',
      stripe_onboarding_complete: isProductionSeed ? hasProductionStripeAccount : true,
      stripe_charges_enabled: isProductionSeed ? hasProductionStripeAccount : true,
      stripe_payouts_enabled: isProductionSeed ? hasProductionStripeAccount : true,
      is_verified: barber.tier !== 'FREE',
      verified_at: barber.tier !== 'FREE' ? new Date() : null,
      metadata: { seeded: true, specialties: ['fades', 'lineups', 'classic cuts'] },
    })),
  );

  await knex('mobile_barber_config').insert([
    {
      id: randomUUID(),
      barber_id: requireAt(barberSeeds, 0, 'test barber').profileId,
      is_enabled: true,
      service_radius_miles: 10,
      fee_structure: 'flat',
      base_fee_cents: 1500,
      per_mile_rate_cents: 0,
      origin_latitude: 37.6467,
      origin_longitude: -84.7729,
      origin_address: '120 N 3rd St, Danville, KY',
      mobile_service_notes:
        'I bring all professional equipment. Please have a chair, outlet, and clear floor space.',
    },
  ]);

  const testClient = requireAt(clients, 0, 'test client');
  await knex('client_addresses').insert([
    {
      id: randomUUID(),
      client_id: testClient.id,
      label: 'Home',
      address_line1: '212 W Main St',
      city: 'Danville',
      state: 'KY',
      zip_code: '40422',
      country: 'US',
      latitude: 37.6454,
      longitude: -84.7739,
      is_default: true,
    },
    {
      id: randomUUID(),
      client_id: testClient.id,
      label: 'Office',
      address_line1: '304 S 4th St',
      city: 'Danville',
      state: 'KY',
      zip_code: '40422',
      country: 'US',
      latitude: 37.6423,
      longitude: -84.7728,
      is_default: false,
    },
  ]);

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
      is_travel_buffer: slot.isTravelBuffer ?? false,
      travel_buffer_for: null,
      travel_buffer_kind: slot.travelBufferKind ?? null,
    })),
  );

  await knex('appointments').insert(
    appointments.map((appointment) => ({
      id: appointment.id,
      client_id: appointment.clientId,
      barber_id: appointment.barberId,
      service_id: appointment.serviceId,
      availability_slot_id: appointment.availabilitySlotId,
      scheduled_at: appointment.scheduledWallClock,
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
      barber_departed_at: appointment.barberDepartedAt,
      is_mobile_service: appointment.isMobileService,
      service_address_line1: appointment.serviceAddressLine1,
      service_address_city: appointment.serviceAddressCity,
      service_address_state: appointment.serviceAddressState,
      service_address_zip: appointment.serviceAddressZip,
      service_address_formatted: appointment.serviceAddressFormatted,
      service_address_source: appointment.serviceAddressSource,
      service_address_is_approximate: appointment.serviceAddressIsApproximate,
      service_latitude: appointment.serviceLatitude,
      service_longitude: appointment.serviceLongitude,
      travel_fee_cents: appointment.travelFeeCents,
      estimated_travel_minutes: appointment.estimatedTravelMinutes,
      distance_miles: appointment.distanceMiles,
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
  await Promise.all(
    slots
      .filter((slot) => slot.isTravelBuffer === true && slot.travelBufferFor !== undefined)
      .map(async (slot): Promise<void> => {
        await knex('availability_slots')
          .where({ id: slot.id })
          .update({
            status: slot.status,
            is_travel_buffer: true,
            travel_buffer_for: slot.travelBufferFor,
            travel_buffer_kind: slot.travelBufferKind ?? null,
          });
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
        barber.tier === 'FREE' || isProductionSeed
          ? null
          : `cus_seed_${barber.profileId.replaceAll('-', '').slice(0, 12)}`,
      stripe_subscription_id:
        barber.tier === 'FREE' || isProductionSeed
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

  await knex('barber_profiles')
    .where({ id: requireAt(barberSeeds, 0, 'test barber').profileId })
    .update({ average_rating: 0, total_reviews: 0, total_clients: 0 });

  await knex('client_saved_barbers').insert([
    {
      id: randomUUID(),
      client_id: requireAt(clients, 0, 'test client saved barber').id,
      barber_id: requireAt(barberSeeds, 0, 'test saved barber').profileId,
    },
  ]);

  await knex('notifications').insert(
    appointments.map((appointment) => ({
      id: randomUUID(),
      user_id: appointment.clientId,
      type: 'APPOINTMENT_CONFIRMED',
      title: 'Appointment confirmed',
      message: 'Your seeded test mobile appointment is ready for live tracking.',
      related_data: { appointmentId: appointment.id },
      is_read: false,
      read_at: null,
      sent_via_email: true,
      sent_via_sms: true,
      sent_via_push: false,
      scheduled_for: null,
      sent_at: new Date(),
    })),
  );
}
