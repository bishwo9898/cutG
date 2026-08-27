import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../app';
import { closeDatabase, pool } from '../config/database';
import { createVerifiedUser, resetTestDatabase } from '../test/fixtures';

beforeEach(async () => {
  await resetTestDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('mobile notifications API', () => {
  it('registers and disables only the authenticated user device', async () => {
    const customer = await createVerifiedUser('CLIENT', 'customer@example.com');
    const barber = await createVerifiedUser('BARBER', 'barber@example.com');
    const customerToken = customer.clerkUserId;
    const barberToken = barber.clerkUserId;
    const device = {
      installationId: 'customer-installation-01',
      expoPushToken: 'ExponentPushToken[customer-device-token-0001]',
      platform: 'ios',
      appVersion: '0.2.0',
    };

    const registered = await request(app)
      .post('/notifications/devices')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(device);
    expect(registered.status).toBe(201);

    const otherUser = await request(app)
      .delete(`/notifications/devices/${device.installationId}`)
      .set('Authorization', `Bearer ${barberToken}`);
    expect(otherUser.body).toEqual({ unregistered: false });

    const owner = await request(app)
      .delete(`/notifications/devices/${device.installationId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(owner.body).toEqual({ unregistered: true });
  });

  it('paginates inbox items and enforces notification ownership', async () => {
    const customer = await createVerifiedUser('CLIENT', 'customer@example.com');
    const barber = await createVerifiedUser('BARBER', 'barber@example.com');
    const customerToken = customer.clerkUserId;
    const barberToken = barber.clerkUserId;

    const created = await pool.query<{ id: string }>(
      `INSERT INTO notifications (user_id,type,title,message,related_data,created_at)
       VALUES
         ($1,'SYSTEM','Second update','Your later update is ready.','{}',CURRENT_TIMESTAMP),
         ($1,'SYSTEM','First update','Your earlier update is ready.','{}',CURRENT_TIMESTAMP-INTERVAL '1 minute')
       RETURNING id`,
      [customer.id],
    );
    const foreign = await pool.query<{ id: string }>(
      `INSERT INTO notifications (user_id,type,title,message,related_data)
       VALUES ($1,'SYSTEM','Private','Only the barber can read this.','{}') RETURNING id`,
      [barber.id],
    );

    const firstPage = await request(app)
      .get('/notifications?limit=1')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(firstPage.status).toBe(200);
    expect(firstPage.body).toMatchObject({ unreadCount: 2 });
    expect(firstPage.body.notifications).toHaveLength(1);
    expect(firstPage.body.nextCursor).toEqual(expect.any(String));

    const secondPage = await request(app)
      .get(`/notifications?limit=1&cursor=${String(firstPage.body.nextCursor)}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(secondPage.body.notifications).toHaveLength(1);
    expect(secondPage.body.nextCursor).toBeNull();

    const forbidden = await request(app)
      .patch(`/notifications/${String(foreign.rows[0]?.id)}/read`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(forbidden.status).toBe(404);

    const read = await request(app)
      .patch(`/notifications/${String(created.rows[0]?.id)}/read`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(read.body).toEqual({ read: true });

    const readAll = await request(app)
      .post('/notifications/read-all')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(readAll.body).toEqual({ readCount: 1 });

    const barberInbox = await request(app)
      .get('/notifications')
      .set('Authorization', `Bearer ${barberToken}`);
    expect(barberInbox.body).toMatchObject({ unreadCount: 1 });
  });
});
