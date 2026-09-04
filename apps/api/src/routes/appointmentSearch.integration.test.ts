// The barber's appointment list is paginated. Filtering the rows already on screen would only
// ever search the first page, so a barber with a year of bookings would be told a real customer
// does not exist. The search has to happen in the query.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { app } from '../app';
import { closeDatabase, pool } from '../config/database';
import {
  createBarberProfileFixture,
  createVerifiedUser,
  resetTestDatabase,
} from '../test/fixtures';

type ListBody = {
  appointments: Array<{ id: string; clientName?: string }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

const PAGE_SIZE = 20;
const TOTAL = 45;

let barberToken = '';
let serviceId = '';
let barberId = '';

beforeAll(async () => {
  await resetTestDatabase();
  const barber = await createVerifiedUser('BARBER', 'search.barber@example.com');
  barberToken = barber.clerkUserId;
  barberId = await createBarberProfileFixture(barber.id);

  const service = await pool.query<{ id: string }>(
    `INSERT INTO services (barber_id,name,price,duration_minutes,category)
     VALUES ($1,'Search Cut',20,30,'haircut') RETURNING id`,
    [barberId],
  );
  serviceId = service.rows[0]?.id ?? '';

  // 45 customers, so the one we search for sits well past the first page.
  for (let index = 0; index < TOTAL; index += 1) {
    const surname = index === TOTAL - 1 ? 'Wolstenholme' : `Common${index}`;
    const client = await createVerifiedUser('CLIENT', `search.client${index}@example.com`);
    await pool.query(`UPDATE users SET first_name=$2, last_name=$3 WHERE id=$1`, [
      client.id,
      'Test',
      surname,
    ]);
    await pool.query(
      `INSERT INTO appointments
        (client_id,barber_id,service_id,scheduled_at,duration_minutes,status,payment_status,
         payment_method,price_quoted,location_address)
       VALUES ($1,$2,$3,$4,30,'COMPLETED','SUCCEEDED','CASH',20,'120 N 3rd St')`,
      [
        client.id,
        barberId,
        serviceId,
        `2026-06-${String((index % 28) + 1).padStart(2, '0')} 10:00`,
      ],
    );
  }
});

afterAll(async () => closeDatabase());

describe('barber appointment search', () => {
  it('pages the full list rather than stopping at the default limit', async () => {
    const first = await request(app)
      .get('/barbers/me/appointments')
      .set('Authorization', `Bearer ${barberToken}`);
    expect(first.status).toBe(200);
    const body = first.body as ListBody;
    expect(body.appointments).toHaveLength(PAGE_SIZE);
    expect(body.pagination).toMatchObject({ page: 1, total: TOTAL, totalPages: 3 });

    const last = await request(app)
      .get('/barbers/me/appointments?page=3')
      .set('Authorization', `Bearer ${barberToken}`);
    expect((last.body as ListBody).appointments).toHaveLength(TOTAL - PAGE_SIZE * 2);
  });

  it('finds a customer who is nowhere near the first page', async () => {
    const response = await request(app)
      .get('/barbers/me/appointments?search=Wolstenholme')
      .set('Authorization', `Bearer ${barberToken}`);
    expect(response.status).toBe(200);
    const body = response.body as ListBody;
    expect(body.appointments).toHaveLength(1);
    expect(body.appointments[0]?.clientName).toBe('Test Wolstenholme');
    // The count has to agree with the rows, or the footer claims results the list cannot show.
    expect(body.pagination.total).toBe(1);
  });

  it('ignores case and matches on either part of the name', async () => {
    const surname = await request(app)
      .get('/barbers/me/appointments?search=wolsten')
      .set('Authorization', `Bearer ${barberToken}`);
    expect((surname.body as ListBody).pagination.total).toBe(1);

    const everyone = await request(app)
      .get('/barbers/me/appointments?search=Test')
      .set('Authorization', `Bearer ${barberToken}`);
    expect((everyone.body as ListBody).pagination.total).toBe(TOTAL);
  });

  it('combines with the status filter instead of replacing it', async () => {
    const response = await request(app)
      .get('/barbers/me/appointments?search=Wolstenholme&status=PENDING')
      .set('Authorization', `Bearer ${barberToken}`);
    expect((response.body as ListBody).pagination.total).toBe(0);
  });

  it('says nothing matched rather than falling back to everything', async () => {
    const response = await request(app)
      .get('/barbers/me/appointments?search=NoSuchPerson')
      .set('Authorization', `Bearer ${barberToken}`);
    expect((response.body as ListBody).appointments).toHaveLength(0);
    expect((response.body as ListBody).pagination.total).toBe(0);
  });
});
