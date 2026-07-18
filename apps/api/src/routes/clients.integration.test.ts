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
let slotId = '';
let clientId = '';
let designId = '';

type LoginBody = { accessToken: string };
type SearchBody = { barbers: Array<{ id: string; serviceCategories: string[] }> };
type SavedBody = { savedBarbers: unknown[] };
type SlotsBody = { slots: Array<{ id: string; isAvailable: boolean }> };
type AppointmentBody = {
  id: string;
  status: string;
  paymentMethod: string;
  styleReference: { id: string; styleName: string } | null;
};
type AppointmentListBody = { appointments: unknown[] };
type CancelBody = { slotFreed: boolean };
type ErrorBody = { error: string };

beforeAll(async () => {
  await resetTestDatabase();
  const barber = await createVerifiedUser('BARBER', 'phase3.barber@example.com');
  const client = await createVerifiedUser('CLIENT', 'phase3.client@example.com');
  clientId = client.id;
  barberId = await createBarberProfileFixture(barber.id);

  const service = await pool.query<{ id: string }>(
    `
      INSERT INTO services (barber_id,name,price,duration_minutes,category)
      VALUES ($1,'Test Fade',25,30,'haircut')
      RETURNING id
    `,
    [barberId],
  );
  serviceId = service.rows[0]?.id ?? '';

  const barberLogin = await request(app)
    .post('/auth/login')
    .send({ email: 'phase3.barber@example.com', password: 'strong-password-123' });
  const clientLogin = await request(app)
    .post('/auth/login')
    .send({ email: 'phase3.client@example.com', password: 'strong-password-123' });
  barberToken = (barberLogin.body as LoginBody).accessToken;
  clientToken = (clientLogin.body as LoginBody).accessToken;

  await request(app)
    .post('/barbers/me/slots/generate')
    .set('Authorization', `Bearer ${barberToken}`)
    .send({ startDate: '2026-08-03', endDate: '2026-08-03' });
  const slots = await request(app).get(`/barbers/${barberId}/slots?date=2026-08-03&days=1`);
  slotId = (slots.body as SlotsBody).slots.find((slot) => slot.isAvailable)?.id ?? '';
  const design = await pool.query<{ id: string }>(
    `INSERT INTO client_hair_designs
      (client_id,style_name,style_category,description,ai_status,generated_asset_key)
     VALUES ($1,'Textured Crop','haircut','Keep the fringe textured.','completed',$2)
     RETURNING id`,
    [clientId, `hair-designs/${clientId}/preview.jpg`],
  );
  designId = design.rows[0]?.id ?? '';
});

afterAll(async () => closeDatabase());

describe('Phase 3 client discovery and booking API', () => {
  it('searches public barbers and exposes public review summaries', async () => {
    const search = await request(app).get('/barbers?category=haircut&limit=5');
    expect(search.status).toBe(200);
    expect((search.body as SearchBody).barbers[0]?.id).toBe(barberId);
    expect((search.body as SearchBody).barbers[0]?.serviceCategories).toContain('haircut');

    const reviews = await request(app).get(`/barbers/${barberId}/reviews`);
    expect(reviews.status).toBe(200);
    expect(reviews.body).toHaveProperty('summary.distribution.5');
  });

  it('allows clients to save and remove barbers while rejecting duplicate saves', async () => {
    const saved = await request(app)
      .post('/clients/me/saved-barbers')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ barberId });
    expect(saved.status).toBe(201);

    const duplicate = await request(app)
      .post('/clients/me/saved-barbers')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ barberId });
    expect(duplicate.status).toBe(409);

    const list = await request(app)
      .get('/clients/me/saved-barbers')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(list.status).toBe(200);
    expect((list.body as SavedBody).savedBarbers).toHaveLength(1);

    const removed = await request(app)
      .delete(`/clients/me/saved-barbers/${barberId}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(removed.status).toBe(200);
  });

  it('books atomically, prevents duplicate booking, and frees the slot on cancel', async () => {
    const booked = await request(app)
      .post('/clients/me/appointments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        barberId,
        serviceId,
        availabilitySlotId: slotId,
        clientNotes: 'Clean neckline',
        designId,
      });
    expect(booked.status).toBe(201);
    expect((booked.body as AppointmentBody).status).toBe('PENDING');
    expect((booked.body as AppointmentBody).paymentMethod).toBe('CASH');
    expect((booked.body as AppointmentBody).styleReference).toMatchObject({
      id: designId,
      styleName: 'Textured Crop',
    });
    const appointmentId = (booked.body as AppointmentBody).id;

    const duplicate = await request(app)
      .post('/clients/me/appointments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ barberId, serviceId, availabilitySlotId: slotId });
    expect(duplicate.status).toBe(400);
    expect((duplicate.body as ErrorBody).error).toBe('SLOT_NOT_AVAILABLE');

    const list = await request(app)
      .get('/clients/me/appointments')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(list.status).toBe(200);
    expect((list.body as AppointmentListBody).appointments.length).toBeGreaterThanOrEqual(1);

    const cancelled = await request(app)
      .delete(`/clients/me/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(cancelled.status).toBe(200);
    expect((cancelled.body as CancelBody).slotFreed).toBe(true);

    const slots = await request(app).get(`/barbers/${barberId}/slots?date=2026-08-03&days=1`);
    expect((slots.body as SlotsBody).slots.find((slot) => slot.id === slotId)?.isAvailable).toBe(
      true,
    );
  });

  it('rejects barber access to client booking routes', async () => {
    const forbidden = await request(app)
      .post('/clients/me/appointments')
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ barberId, serviceId, availabilitySlotId: slotId });
    expect(forbidden.status).toBe(403);
  });
});
