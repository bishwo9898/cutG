import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { app } from '../app';
import { closeDatabase, pool } from '../config/database';
import {
  createBarberProfileFixture,
  createVerifiedUser,
  resetTestDatabase,
} from '../test/fixtures';

let barberToken = '';
let clientToken = '';
let barberId = '';
let serviceId = '';
let addressId = '';
let slotId = '';
type LoginBody = { accessToken: string };
type SearchBody = {
  barbers: Array<{ mobileService: { baseFee: number } | null; nextAvailableSlot: string | null }>;
};
type AddressBody = { id: string; label: string; latitude: number; longitude: number };
type AddressListBody = { addresses: unknown[] };
type EstimateBody = { travelFee: number };
type AppointmentBody = { id: string; status: string; paymentMethod: string };
type MobileConfigBody = {
  isEnabled: boolean;
  baseFee: number;
  originCity: string | null;
  approximateOrigin: { latitude: number; longitude: number };
};
type PublicSlotsBody = { slots: Array<{ startTime: string; availableForMobile: boolean }> };
type TimelineBody = { timeline: unknown[]; currentStatus: string; arrivedAt: string | null };
type BarberLocationBody = { isTracking: boolean };

beforeAll(async () => {
  await resetTestDatabase();
  const barber = await createVerifiedUser('BARBER', 'mobile.barber@example.com');
  await createVerifiedUser('CLIENT', 'mobile.client@example.com');
  barberId = await createBarberProfileFixture(barber.id);
  await pool.query("UPDATE barber_profiles SET subscription_tier='BASIC' WHERE id=$1", [barberId]);
  const service = await pool.query<{ id: string }>(
    "INSERT INTO services (barber_id,name,price,duration_minutes,category) VALUES ($1,'Mobile Fade',25,30,'haircut') RETURNING id",
    [barberId],
  );
  serviceId = service.rows[0]?.id ?? '';
  barberToken = (
    await request(app)
      .post('/auth/login')
      .send({ email: 'mobile.barber@example.com', password: 'strong-password-123' })
      .then((response) => response.body as LoginBody)
  ).accessToken;
  clientToken = (
    await request(app)
      .post('/auth/login')
      .send({ email: 'mobile.client@example.com', password: 'strong-password-123' })
      .then((response) => response.body as LoginBody)
  ).accessToken;
});

afterAll(async () => closeDatabase());

describe('Phase 6 mobile barber API', () => {
  it('creates an enabled BASIC-tier config and exposes it publicly', async () => {
    const updated = await request(app)
      .put('/barbers/me/mobile')
      .set('Authorization', `Bearer ${barberToken}`)
      .send({
        isEnabled: true,
        serviceRadiusMiles: 10,
        feeStructure: 'flat',
        baseFeeCents: 1500,
        perMileRateCents: 0,
        originLatitude: 40.6782,
        originLongitude: -73.9442,
        originAddress: '123 Main St, Brooklyn, NY',
      });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ isEnabled: true, baseFeeCents: 1500 });

    const search = await request(app).get('/barbers?mobileOnly=true');
    expect(search.status).toBe(200);
    const searchBody = search.body as SearchBody;
    expect(searchBody.barbers).toHaveLength(1);
    expect(searchBody.barbers[0]).toHaveProperty('mobileService.baseFee', 15);
    expect(searchBody.barbers[0]).toHaveProperty('nextAvailableSlot');

    const searchAlias = await request(app).get('/barbers/search?mobileOnly=true');
    expect(searchAlias.status).toBe(200);
    expect((searchAlias.body as SearchBody).barbers).toHaveLength(1);

    const publicConfig = await request(app).get(`/barbers/${barberId}/mobile`);
    expect(publicConfig.status).toBe(200);
    expect(publicConfig.body as MobileConfigBody).toMatchObject({
      isEnabled: true,
      baseFee: 15,
      approximateOrigin: { latitude: 40.68, longitude: -73.94 },
    });
    expect(publicConfig.body).not.toHaveProperty('originLatitude');
  });

  it('geocodes, defaults, lists, and updates owned client addresses', async () => {
    await request(app)
      .post('/clients/me/locations/reverse-geocode')
      .send({ latitude: 37.6454, longitude: -84.7739 })
      .expect(401);
    await request(app)
      .post('/clients/me/locations/reverse-geocode')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ latitude: 95, longitude: -84.7739 })
      .expect(422);

    const reversed = await request(app)
      .post('/clients/me/locations/reverse-geocode')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ barberId, latitude: 37.6454, longitude: -84.7739 });
    expect(reversed.status).toBe(200);
    expect(reversed.body).toMatchObject({
      city: 'Boston',
      isApproximateAddress: true,
      source: 'coordinate_fallback',
      state: 'MA',
      latitude: 37.6454,
      longitude: -84.7739,
    });

    const created = await request(app)
      .post('/clients/me/addresses')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        label: 'Home',
        addressLine1: '307 W Broadway St',
        city: 'Danville',
        state: 'KY',
        zipCode: '40422',
      });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ isDefault: true, latitude: 40.6892 });
    addressId = (created.body as AddressBody).id;

    const list = await request(app)
      .get('/clients/me/addresses')
      .set('Authorization', `Bearer ${clientToken}`);
    expect((list.body as AddressListBody).addresses).toHaveLength(1);
    const renamed = await request(app)
      .patch(`/clients/me/addresses/${addressId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ label: 'Apartment' });
    expect((renamed.body as AddressBody).label).toBe('Apartment');

    const pinned = await request(app)
      .patch(`/clients/me/addresses/${addressId}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ latitude: 40.68923, longitude: -73.98514 });
    expect(pinned.status).toBe(200);
    expect(pinned.body as AddressBody).toMatchObject({
      latitude: 40.68923,
      longitude: -73.98514,
    });
  });

  it('estimates travel, books buffer slots atomically, and advances mobile statuses', async () => {
    const generated = await request(app)
      .post('/barbers/me/slots/generate')
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ startDate: '2026-08-03', endDate: '2026-08-03' });
    expect(generated.status).toBe(200);
    const slots = await pool.query<{ id: string }>(
      "SELECT id FROM availability_slots WHERE barber_id=$1 AND slot_date='2026-08-03' AND start_time='10:00'",
      [barberId],
    );
    slotId = slots.rows[0]?.id ?? '';

    const publicSlots = await request(app).get(
      `/barbers/${barberId}/slots?date=2026-08-03&days=1&mobileService=true&travelMinutes=14`,
    );
    expect(publicSlots.status).toBe(200);
    const publicSlotsBody = publicSlots.body as PublicSlotsBody;
    expect(
      publicSlotsBody.slots.every((slot) => typeof slot.availableForMobile === 'boolean'),
    ).toBe(true);
    expect(publicSlotsBody.slots.find((slot) => slot.startTime === '09:00')).toMatchObject({
      availableForMobile: false,
    });
    expect(publicSlotsBody.slots.find((slot) => slot.startTime === '10:00')).toMatchObject({
      availableForMobile: true,
    });
    expect(publicSlotsBody.slots.find((slot) => slot.startTime === '16:30')).toMatchObject({
      availableForMobile: false,
    });

    const estimate = await request(app)
      .post('/barbers/me/mobile/estimate')
      .send({ barberId, destinationLatitude: 40.6892, destinationLongitude: -73.9851 });
    expect(estimate.status).toBe(200);
    expect((estimate.body as EstimateBody).travelFee).toBe(15);

    const booked = await request(app)
      .post('/clients/me/appointments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        barberId,
        serviceId,
        availabilitySlotId: slotId,
        isMobileService: true,
        clientAddressOneTime: {
          addressLine1: 'Pinned service location',
          city: 'Brooklyn',
          state: 'NY',
          zipCode: '11201',
          country: 'US',
          latitude: 40.6892,
          longitude: -73.9851,
          formattedAddress: 'Pinned service location near Boston, MA 40422',
          source: 'coordinate_fallback',
          isApproximateAddress: true,
        },
      });
    expect(booked.status).toBe(201);
    expect(booked.body).toMatchObject({
      isMobileService: true,
      paymentMethod: 'CASH',
      travelFee: 15,
      bufferSlotsBlocked: 2,
      serviceAddress: {
        formattedAddress: 'Pinned service location near Boston, MA 40422',
        source: 'coordinate_fallback',
        isApproximateAddress: true,
      },
    });
    const appointmentId = (booked.body as AppointmentBody).id;

    const buffer = await pool.query<{ count: number; travel_buffer_kind: string }>(
      `SELECT COUNT(*)::int AS count, travel_buffer_kind
       FROM availability_slots
       WHERE travel_buffer_for=$1 AND is_travel_buffer=true
       GROUP BY travel_buffer_kind
       ORDER BY travel_buffer_kind`,
      [appointmentId],
    );
    expect(buffer.rows).toEqual([
      { count: 1, travel_buffer_kind: 'OUTBOUND' },
      { count: 1, travel_buffer_kind: 'RETURN' },
    ]);

    await request(app)
      .patch(`/barbers/me/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ status: 'CONFIRMED' })
      .expect(200);
    await request(app)
      .patch(`/barbers/me/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(400);
    const departed = await request(app)
      .patch(`/barbers/me/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ status: 'ON_THE_WAY' });
    expect((departed.body as AppointmentBody).status).toBe('ON_THE_WAY');
    await request(app)
      .post(`/barbers/me/appointments/${appointmentId}/location`)
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ latitude: 40.682, longitude: -73.99, accuracyMeters: 10 })
      .expect(200);
    const location = await request(app)
      .get(`/clients/me/appointments/${appointmentId}/barber-location`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(location.status).toBe(200);
    expect(location.body as BarberLocationBody).toMatchObject({ isTracking: true });
    const arrived = await request(app)
      .patch(`/barbers/me/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ status: 'ARRIVED' });
    expect((arrived.body as AppointmentBody).status).toBe('ARRIVED');
    const stalePing = await request(app)
      .post(`/barbers/me/appointments/${appointmentId}/location`)
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ latitude: 40.6892, longitude: -73.9851 });
    expect(stalePing.status).toBe(400);
    expect(stalePing.body).toHaveProperty('error', 'TRACKING_NOT_ACTIVE');

    const timeline = await request(app)
      .get(`/clients/me/appointments/${appointmentId}/status-updates`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(timeline.status).toBe(200);
    expect(timeline.body as TimelineBody).toMatchObject({ currentStatus: 'ARRIVED' });
    expect((timeline.body as TimelineBody).timeline).toHaveLength(6);
    expect((timeline.body as TimelineBody).arrivedAt).not.toBeNull();

    const inProgress = await request(app)
      .patch(`/barbers/me/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ status: 'IN_PROGRESS' });
    expect((inProgress.body as AppointmentBody).status).toBe('IN_PROGRESS');
    const inProgressPing = await request(app)
      .post(`/barbers/me/appointments/${appointmentId}/location`)
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ latitude: 40.68925, longitude: -73.98512 });
    expect(inProgressPing.status).toBe(400);
    expect(inProgressPing.body).toHaveProperty('error', 'TRACKING_NOT_ACTIVE');
    await request(app)
      .patch(`/barbers/me/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ status: 'COMPLETED' })
      .expect(200);
    await request(app)
      .post(`/barbers/me/appointments/${appointmentId}/location`)
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ latitude: 40.68925, longitude: -73.98512 })
      .expect(400);
  });
});
