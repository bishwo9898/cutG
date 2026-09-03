// A booked slot must keep the wall clock the barber published. This file deliberately runs on a
// non-UTC clock: `scheduled_at` used to be read out of Postgres as a bare timestamp, which node-pg
// turns into a JS Date in the *server's* zone, and writing that Date back into the timestamptz
// column re-encoded it as an instant. On a UTC machine the two cancel out and nothing looks wrong;
// on a UTC-4 laptop a 14:00 booking was stored as 18:00+00, and the barber's calendar (which reads
// the slot) and Today list (which reads the appointment) disagreed by four hours about the same
// customer.
process.env.TZ = 'America/New_York';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { app } from '../app';
import { closeDatabase, pool } from '../config/database';
import {
  createBarberProfileFixture,
  createVerifiedUser,
  nextOpenBookingDate,
  resetTestDatabase,
} from '../test/fixtures';

type SlotsBody = { slots: Array<{ id: string; startTime: string; isAvailable: boolean }> };
type AppointmentBody = { id: string; scheduledAt: string; startTime: string };

const bookingDate = nextOpenBookingDate();
let barberId = '';
let serviceId = '';
let slotId = '';
let slotStartTime = '';
let barberToken = '';
let clientToken = '';

beforeAll(async () => {
  await resetTestDatabase();
  const barber = await createVerifiedUser('BARBER', 'booking-time.barber@example.com');
  const client = await createVerifiedUser('CLIENT', 'booking-time.client@example.com');
  barberId = await createBarberProfileFixture(barber.id);
  barberToken = barber.clerkUserId;
  clientToken = client.clerkUserId;

  const service = await pool.query<{ id: string }>(
    `INSERT INTO services (barber_id,name,price,duration_minutes,category)
     VALUES ($1,'Wall Clock Cut',25,30,'haircut') RETURNING id`,
    [barberId],
  );
  serviceId = service.rows[0]?.id ?? '';

  await request(app)
    .post('/barbers/me/slots/generate')
    .set('Authorization', `Bearer ${barberToken}`)
    .send({ startDate: bookingDate, endDate: bookingDate });
  const slots = await request(app).get(`/barbers/${barberId}/slots?date=${bookingDate}&days=1`);
  const slot = (slots.body as SlotsBody).slots.find((entry) => entry.isAvailable);
  slotId = slot?.id ?? '';
  slotStartTime = slot?.startTime ?? '';
});

afterAll(async () => closeDatabase());

describe('booking keeps the published wall clock', () => {
  it('stores the appointment at the slot time, not shifted by the server timezone', async () => {
    expect(process.env.TZ).toBe('America/New_York');
    expect(slotId).not.toBe('');
    expect(slotStartTime).not.toBe('');

    const booked = await request(app)
      .post('/clients/me/appointments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ barberId, serviceId, availabilitySlotId: slotId });
    expect(booked.status).toBe(201);

    // What the customer sees back must be the time they picked.
    expect((booked.body as AppointmentBody).startTime).toBe(slotStartTime);
    expect((booked.body as AppointmentBody).scheduledAt).toBe(
      `${bookingDate}T${slotStartTime}:00.000Z`,
    );

    // And the row itself must carry that wall clock, so the barber's calendar — which joins on
    // slot_date and start_time — lines the appointment up with the slot it was booked against.
    const stored = await pool.query<{ wall_clock: string; slot_clock: string }>(
      `SELECT to_char(a.scheduled_at AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI') AS wall_clock,
              to_char(s.slot_date + s.start_time,'YYYY-MM-DD HH24:MI') AS slot_clock
       FROM appointments a
       JOIN availability_slots s ON s.id = a.availability_slot_id
       WHERE a.id = $1`,
      [(booked.body as AppointmentBody).id],
    );
    expect(stored.rows[0]?.wall_clock).toBe(stored.rows[0]?.slot_clock);
    expect(stored.rows[0]?.wall_clock).toBe(`${bookingDate} ${slotStartTime}`);
  });
});
