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

const bookingDate = nextOpenBookingDate();
let barberToken = '';
let clientToken = '';
let barberId = '';
let serviceId = '';
let slotId = '';
let clientId = '';
let designId = '';
let otherDesignId = '';

type SearchBody = { barbers: Array<{ id: string; serviceCategories: string[] }> };
type SavedBody = { savedBarbers: unknown[] };
type SlotsBody = { slots: Array<{ id: string; isAvailable: boolean }> };
type AppointmentBody = {
  id: string;
  status: string;
  paymentMethod: string;
  styleNotes: string | null;
  styleReference: { id: string; styleName: string } | null;
};
type DesignsBody = { designs: Array<{ id: string }> };
type AppointmentListBody = { appointments: unknown[] };
type CancelBody = { slotFreed: boolean };
type ErrorBody = { error: string };

beforeAll(async () => {
  await resetTestDatabase();
  const barber = await createVerifiedUser('BARBER', 'phase3.barber@example.com');
  const client = await createVerifiedUser('CLIENT', 'phase3.client@example.com');
  const otherClient = await createVerifiedUser('CLIENT', 'phase3.other-client@example.com');
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

  barberToken = barber.clerkUserId;
  clientToken = client.clerkUserId;

  await request(app)
    .post('/barbers/me/slots/generate')
    .set('Authorization', `Bearer ${barberToken}`)
    .send({ startDate: bookingDate, endDate: bookingDate });
  const slots = await request(app).get(`/barbers/${barberId}/slots?date=${bookingDate}&days=1`);
  slotId = (slots.body as SlotsBody).slots.find((slot) => slot.isAvailable)?.id ?? '';
  const design = await pool.query<{ id: string }>(
    `INSERT INTO client_hair_designs
      (client_id,style_name,style_category,description,ai_status,generated_asset_key)
     VALUES ($1,'Textured Crop','haircut','Keep the fringe textured.','completed',$2)
     RETURNING id`,
    [clientId, `hair-designs/${clientId}/preview.jpg`],
  );
  designId = design.rows[0]?.id ?? '';
  const otherDesign = await pool.query<{ id: string }>(
    `INSERT INTO client_hair_designs
      (client_id,style_name,style_category,description,ai_status,generated_asset_key)
     VALUES ($1,'Private Other Look','haircut','Must stay private.','completed',$2)
     RETURNING id`,
    [otherClient.id, `hair-designs/${otherClient.id}/private-preview.jpg`],
  );
  otherDesignId = otherDesign.rows[0]?.id ?? '';
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

  it('lists only the authenticated client’s saved looks without reusable response caching', async () => {
    const response = await request(app)
      .get('/clients/me/designs')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('private');
    expect(response.headers['cache-control']).toContain('no-store');
    const ids = (response.body as DesignsBody).designs.map((design) => design.id);
    expect(ids).toContain(designId);
    expect(ids).not.toContain(otherDesignId);
  });

  it('rejects a saved look owned by another client before reserving the slot', async () => {
    const response = await request(app)
      .post('/clients/me/appointments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        barberId,
        serviceId,
        availabilitySlotId: slotId,
        designId: otherDesignId,
      });
    expect(response.status).toBe(404);
    expect((response.body as ErrorBody).error).toBe('DESIGN_NOT_AVAILABLE');
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
        styleNotes: 'Keep the temple blend soft.',
      });
    expect(booked.status).toBe(201);
    expect((booked.body as AppointmentBody).status).toBe('PENDING');
    expect((booked.body as AppointmentBody).paymentMethod).toBe('CASH');
    expect((booked.body as AppointmentBody).styleReference).toMatchObject({
      id: designId,
      styleName: 'Textured Crop',
    });
    expect((booked.body as AppointmentBody).styleNotes).toContain('Keep the temple blend soft.');
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

    const slots = await request(app).get(`/barbers/${barberId}/slots?date=${bookingDate}&days=1`);
    expect((slots.body as SlotsBody).slots.find((slot) => slot.id === slotId)?.isAvailable).toBe(
      true,
    );
  });

  it('sends a new-style description without requiring a saved look', async () => {
    const booked = await request(app)
      .post('/clients/me/appointments')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        barberId,
        serviceId,
        availabilitySlotId: slotId,
        styleNotes: 'Try a fresh low taper with longer curls on top.',
      });
    expect(booked.status).toBe(201);
    expect((booked.body as AppointmentBody).styleReference).toBeNull();
    expect((booked.body as AppointmentBody).styleNotes).toBe(
      'Try a fresh low taper with longer curls on top.',
    );
    await request(app)
      .delete(`/clients/me/appointments/${String((booked.body as AppointmentBody).id)}`)
      .set('Authorization', `Bearer ${clientToken}`);
  });

  it('rejects barber access to client booking routes', async () => {
    const forbidden = await request(app)
      .post('/clients/me/appointments')
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ barberId, serviceId, availabilitySlotId: slotId });
    expect(forbidden.status).toBe(403);
  });
});
