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
let appointmentId = '';
type LoginBody = { accessToken: string };
type DesignBody = { id: string };
type LocationBody = { distanceRemainingMiles: number };
type BarberAppointmentsBody = {
  appointments: Array<{ id: string; styleReference: { styleName: string } | null }>;
};

beforeAll(async () => {
  await resetTestDatabase();
  const barber = await createVerifiedUser('BARBER', 'phase9.barber@example.com');
  const client = await createVerifiedUser('CLIENT', 'phase9.client@example.com');
  barberId = await createBarberProfileFixture(barber.id);
  const service = await pool.query<{ id: string }>(
    `INSERT INTO services (barber_id,name,price,duration_minutes,category)
     VALUES ($1,'Tracking Cut',32,30,'haircut') RETURNING id`,
    [barberId],
  );
  const appointment = await pool.query<{ id: string }>(
    `INSERT INTO appointments
      (client_id,barber_id,service_id,scheduled_at,duration_minutes,status,payment_status,
       location_address,price_quoted,is_mobile_service,service_latitude,service_longitude,
       service_address_line1,service_address_city,service_address_state,service_address_zip)
     VALUES ($1,$2,$3,CURRENT_TIMESTAMP + interval '1 day',30,'CONFIRMED','PENDING',
       '10 Client St',32,true,37.6454,-84.7739,'10 Client St','Danville','KY','40422')
     RETURNING id`,
    [client.id, barberId, service.rows[0]?.id],
  );
  appointmentId = appointment.rows[0]?.id ?? '';
  barberToken = (
    await request(app)
      .post('/auth/login')
      .send({ email: 'phase9.barber@example.com', password: 'strong-password-123' })
      .then((response) => response.body as LoginBody)
  ).accessToken;
  clientToken = (
    await request(app)
      .post('/auth/login')
      .send({ email: 'phase9.client@example.com', password: 'strong-password-123' })
      .then((response) => response.body as LoginBody)
  ).accessToken;
});

afterAll(async () => closeDatabase());

describe('Phase 9 GPS tracking and hair designs', () => {
  it('only records owned location pings while tracking is active', async () => {
    const inactive = await request(app)
      .post(`/barbers/me/appointments/${appointmentId}/location`)
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ latitude: 37.6467, longitude: -84.7729 });
    expect(inactive.status).toBe(400);
    expect(inactive.body).toHaveProperty('error', 'TRACKING_NOT_ACTIVE');

    await pool.query(
      "UPDATE appointments SET status='ON_THE_WAY',barber_departed_at=CURRENT_TIMESTAMP WHERE id=$1",
      [appointmentId],
    );
    const recorded = await request(app)
      .post(`/barbers/me/appointments/${appointmentId}/location`)
      .set('Authorization', `Bearer ${barberToken}`)
      .send({
        latitude: 37.6467,
        longitude: -84.7729,
        accuracyMeters: 4.2,
        headingDegrees: 180,
      });
    expect(recorded.status).toBe(200);
    expect(recorded.body).toHaveProperty('recorded', true);

    const location = await request(app)
      .get(`/clients/me/appointments/${appointmentId}/barber-location`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(location.status).toBe(200);
    expect(location.body).toMatchObject({
      isTracking: true,
      appointmentId,
      lastPing: { latitude: 37.6467, longitude: -84.7729 },
    });
    expect((location.body as LocationBody).distanceRemainingMiles).toBeGreaterThanOrEqual(0);
  });

  it('creates, lists, and attaches an owned placeholder design', async () => {
    const created = await request(app)
      .post('/clients/me/designs')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        styleName: 'Low Fade with Texture',
        styleCategory: 'haircut',
        description: 'Low fade, natural texture on top.',
      });
    expect(created.status).toBe(201);
    expect(created.body).toHaveProperty('aiStatus', 'placeholder');
    const designId = (created.body as DesignBody).id;

    const attached = await request(app)
      .post(`/clients/me/designs/${designId}/attach`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ appointmentId });
    expect(attached.status).toBe(200);

    const designs = await request(app)
      .get('/clients/me/designs')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(designs.body).toHaveProperty('designs.0.appointmentId', appointmentId);

    const barberAppointments = await request(app)
      .get('/barbers/me/appointments')
      .set('Authorization', `Bearer ${barberToken}`);
    const matching = (barberAppointments.body as BarberAppointmentsBody).appointments.find(
      (appointment) => appointment.id === appointmentId,
    );
    expect(matching?.styleReference?.styleName).toBe('Low Fade with Texture');
  });
});
