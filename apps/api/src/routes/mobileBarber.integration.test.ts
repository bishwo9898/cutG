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
type SearchBody = { barbers: Array<{ mobileService: { baseFee: number } | null }> };
type AddressBody = { id: string; label: string };
type AddressListBody = { addresses: unknown[] };
type EstimateBody = { travelFee: number };
type AppointmentBody = { id: string; status: string };

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
  });

  it('geocodes, defaults, lists, and updates owned client addresses', async () => {
    const created = await request(app)
      .post('/clients/me/addresses')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        label: 'Home',
        addressLine1: '456 Oak Ave',
        city: 'Brooklyn',
        state: 'NY',
        zipCode: '11201',
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

    const estimate = await request(app)
      .post('/barbers/me/mobile/estimate')
      .set('Authorization', `Bearer ${clientToken}`)
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
        clientAddressId: addressId,
      });
    expect(booked.status).toBe(201);
    expect(booked.body).toMatchObject({
      isMobileService: true,
      travelFee: 15,
      bufferSlotsBlocked: 1,
    });
    const appointmentId = (booked.body as AppointmentBody).id;

    const buffer = await pool.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM availability_slots WHERE travel_buffer_for=$1 AND is_travel_buffer=true',
      [appointmentId],
    );
    expect(buffer.rows[0]?.count).toBe(1);

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
    const arrived = await request(app)
      .patch(`/barbers/me/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ status: 'ARRIVED' });
    expect((arrived.body as AppointmentBody).status).toBe('ARRIVED');
  });
});
