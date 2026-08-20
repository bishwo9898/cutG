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
let otherBarberToken = '';
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
  const otherBarber = await createVerifiedUser('BARBER', 'phase9.other-barber@example.com');
  const client = await createVerifiedUser('CLIENT', 'phase9.client@example.com');
  barberId = await createBarberProfileFixture(barber.id);
  await createBarberProfileFixture(otherBarber.id);
  await pool.query(
    `INSERT INTO mobile_barber_config
      (barber_id,is_enabled,origin_latitude,origin_longitude,origin_address)
     VALUES ($1,true,37.6467,-84.7729,'120 N 3rd St, Danville, KY')`,
    [barberId],
  );
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
  otherBarberToken = (
    await request(app)
      .post('/auth/login')
      .send({ email: 'phase9.other-barber@example.com', password: 'strong-password-123' })
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
  it('returns an owned booking detail and starts the journey idempotently', async () => {
    const detail = await request(app)
      .get(`/barbers/me/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${barberToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      id: appointmentId,
      isMobileService: true,
      location: { kind: 'MOBILE', addressLine1: '10 Client St' },
      pricing: { serviceFee: 32, travelFee: 0, total: 32, currency: 'USD' },
      journey: {
        isTracking: false,
        routeOrigin: { latitude: 37.6467, longitude: -84.7729 },
      },
    });

    await request(app)
      .get(`/barbers/me/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${otherBarberToken}`)
      .expect(404);

    const inactive = await request(app)
      .post(`/barbers/me/appointments/${appointmentId}/location`)
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ latitude: 37.6467, longitude: -84.7729 });
    expect(inactive.status).toBe(400);
    expect(inactive.body).toHaveProperty('error', 'TRACKING_NOT_ACTIVE');

    const started = await request(app)
      .post(`/barbers/me/appointments/${appointmentId}/journey/start`)
      .set('Authorization', `Bearer ${barberToken}`)
      .send({
        latitude: 37.6467,
        longitude: -84.7729,
        accuracyMeters: 4.2,
        headingDegrees: 180,
      });
    expect(started.status).toBe(200);
    expect(started.body).toMatchObject({
      appointment: { id: appointmentId, status: 'ON_THE_WAY' },
      tracking: { active: true },
    });

    await request(app)
      .post(`/barbers/me/appointments/${appointmentId}/journey/start`)
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ latitude: 37.6468, longitude: -84.7728 })
      .expect(200);

    const notificationCount = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM notifications
       WHERE related_data->>'appointmentId'=$1 AND message='Your barber is on the way!'`,
      [appointmentId],
    );
    expect(notificationCount.rows[0]?.count).toBe(1);

    const location = await request(app)
      .get(`/clients/me/appointments/${appointmentId}/barber-location`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(location.status).toBe(200);
    expect(location.body).toMatchObject({
      isTracking: true,
      appointmentId,
      lastPing: { latitude: 37.6468, longitude: -84.7728 },
    });
    expect((location.body as LocationBody).distanceRemainingMiles).toBeGreaterThanOrEqual(0);

    await request(app)
      .patch(`/barbers/me/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ status: 'ARRIVED' })
      .expect(200);
    const afterArrival = await request(app)
      .post(`/barbers/me/appointments/${appointmentId}/location`)
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ latitude: 37.6469, longitude: -84.7727 });
    expect(afterArrival.status).toBe(400);
    expect(afterArrival.body).toHaveProperty('error', 'TRACKING_NOT_ACTIVE');
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
