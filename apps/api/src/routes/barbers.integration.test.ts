import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { app } from '../app';
import { closeDatabase } from '../config/database';
import {
  createBarberProfileFixture,
  createVerifiedUser,
  resetTestDatabase,
} from '../test/fixtures';

let barberToken = '';
let clientToken = '';
let barberId = '';
type LoginBody = { accessToken: string };
type ProfileBody = { id: string; businessName: string };
type GenerateBody = { generated: number };
type ServiceBody = { id: string; imageUrl: string | null };
type PortfolioItemBody = { id: string; isPublished: boolean };
type PrivatePortfolioBody = {
  items: Array<{ id: string; title: string }>;
  trust: {
    totalClients: number;
    repeatClientPercentage: number | null;
    monthlyRepeatClients: unknown[];
  };
};
type CompletedPortfolioBody = { portfolioCompletedAt: string };

beforeAll(async () => {
  await resetTestDatabase();
  const barber = await createVerifiedUser('BARBER', 'barber.integration@example.com');
  await createBarberProfileFixture(barber.id);
  await createVerifiedUser('CLIENT', 'client.integration@example.com');

  const barberLogin = await request(app)
    .post('/auth/login')
    .send({ email: 'barber.integration@example.com', password: 'strong-password-123' });
  const clientLogin = await request(app)
    .post('/auth/login')
    .send({ email: 'client.integration@example.com', password: 'strong-password-123' });
  barberToken = (barberLogin.body as LoginBody).accessToken;
  clientToken = (clientLogin.body as LoginBody).accessToken;
});

afterAll(async () => closeDatabase());

describe('Phase 2 barber API', () => {
  it('preserves root and health endpoints', async () => {
    expect((await request(app).get('/')).status).toBe(200);
    expect((await request(app).get('/health')).status).toBe(200);
  });

  it('allows a barber to access their profile and rejects clients', async () => {
    const profile = await request(app)
      .get('/barbers/me')
      .set('Authorization', `Bearer ${barberToken}`);
    expect(profile.status).toBe(200);
    const body = profile.body as ProfileBody;
    expect(body.businessName).toEqual(expect.any(String));
    barberId = body.id;

    const forbidden = await request(app)
      .get('/barbers/me')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(forbidden.status).toBe(403);
  });

  it('validates duplicate schedule days and supports idempotent generation', async () => {
    const invalid = await request(app)
      .put('/barbers/me/schedule')
      .set('Authorization', `Bearer ${barberToken}`)
      .send({
        schedule: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', slotDurationMinutes: 30 },
          { dayOfWeek: 1, startTime: '10:00', endTime: '18:00', slotDurationMinutes: 30 },
        ],
      });
    expect(invalid.status).toBe(422);

    const range = { startDate: '2026-08-03', endDate: '2026-08-05' };
    const first = await request(app)
      .post('/barbers/me/slots/generate')
      .set('Authorization', `Bearer ${barberToken}`)
      .send(range);
    const second = await request(app)
      .post('/barbers/me/slots/generate')
      .set('Authorization', `Bearer ${barberToken}`)
      .send(range);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((second.body as GenerateBody).generated).toBe(0);
  });

  it('saves a mapped shop location, suggests it, and exposes it as a public business address', async () => {
    const updated = await request(app)
      .patch('/barbers/me/profile')
      .set('Authorization', `Bearer ${barberToken}`)
      .send({
        address: '1 Test Street',
        city: 'Boston',
        state: 'MA',
        zipCode: '02108',
        latitude: 42.3601,
        longitude: -71.0589,
      });
    expect(updated.status).toBe(200);

    const suggestions = await request(app)
      .post('/barbers/me/shop-location/search')
      .set('Authorization', `Bearer ${barberToken}`)
      .send({ query: 'Fixture Studio' });
    expect(suggestions.status).toBe(200);
    expect(suggestions.body).toMatchObject({
      source: 'saved',
      suggestions: [
        {
          name: 'Fixture Studio',
          addressLine1: '1 Test Street',
          latitude: 42.3601,
          longitude: -71.0589,
        },
      ],
    });

    const response = await request(app).get(`/barbers/${barberId}`);
    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty('latitude');
    expect(response.body).not.toHaveProperty('address');
    expect(response.body).not.toHaveProperty('stripeAccountId');
    expect(response.body).toMatchObject({
      shopLocation: {
        address: '1 Test Street',
        city: 'Boston',
        state: 'MA',
        zipCode: '02108',
        latitude: 42.3601,
        longitude: -71.0589,
      },
    });
  });

  it('keeps service images optional and rejects unsupported uploads', async () => {
    const created = await request(app)
      .post('/barbers/me/services')
      .set('Authorization', `Bearer ${barberToken}`)
      .send({
        name: 'Shape up',
        description: 'Clean edges and neckline.',
        price: 22,
        durationMinutes: 30,
        category: 'haircut',
      });
    expect(created.status).toBe(201);
    const service = created.body as ServiceBody;
    expect(service.imageUrl).toBeNull();

    const unsupported = await request(app)
      .post(`/barbers/me/services/${service.id}/image`)
      .set('Authorization', `Bearer ${barberToken}`)
      .set('Content-Type', 'image/gif')
      .send(Buffer.from('not-a-supported-image'));
    expect(unsupported.status).toBe(415);
    expect(unsupported.body).toMatchObject({ code: 'UNSUPPORTED_SERVICE_IMAGE' });

    const removed = await request(app)
      .delete(`/barbers/me/services/${service.id}/image`)
      .set('Authorization', `Bearer ${barberToken}`);
    expect(removed.status).toBe(200);
    expect((removed.body as ServiceBody).imageUrl).toBeNull();

    const publicServices = await request(app).get(`/barbers/${barberId}/services`);
    expect(publicServices.status).toBe(200);
    expect(publicServices.body).toMatchObject({
      services: [expect.objectContaining({ id: service.id, imageUrl: null })],
    });
  });

  it('keeps portfolio drafts private and publishes only safe structured career data', async () => {
    const createdWork = await request(app)
      .post('/barbers/me/portfolio/items')
      .set('Authorization', `Bearer ${barberToken}`)
      .send({
        title: 'Textured taper',
        description: 'Curl definition with a clean taper.',
        category: 'TAPER',
        hairType: 'CURLY',
        hairDensity: 'THICK',
        hairLengthBefore: '3 inches',
        hairLengthAfter: '2 inches',
        faceShape: 'OVAL',
        cutStyle: 'Low taper',
        timeTakenMinutes: 50,
        productsUsed: ['Curl cream'],
        difficulty: 'ADVANCED',
        isFeatured: true,
      });
    expect(createdWork.status).toBe(201);
    const work = createdWork.body as PortfolioItemBody;
    expect(work.isPublished).toBe(false);

    const privatePortfolio = await request(app)
      .get('/barbers/me/portfolio')
      .set('Authorization', `Bearer ${barberToken}`);
    expect(privatePortfolio.status).toBe(200);
    const privateBody = privatePortfolio.body as PrivatePortfolioBody;
    expect(privateBody).toMatchObject({
      items: [expect.objectContaining({ id: work.id, title: 'Textured taper' })],
      trust: {
        totalClients: 0,
        repeatClientPercentage: null,
      },
    });
    expect(Array.isArray(privateBody.trust.monthlyRepeatClients)).toBe(true);

    const clientCannotManage = await request(app)
      .get('/barbers/me/portfolio')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(clientCannotManage.status).toBe(403);

    const experience = await request(app)
      .post('/barbers/me/portfolio/experience')
      .set('Authorization', `Bearer ${barberToken}`)
      .send({
        shopName: 'Elite Cuts',
        title: 'Senior barber',
        startDate: '2022-01-01',
        isCurrent: true,
      });
    expect(experience.status).toBe(201);

    const certification = await request(app)
      .post('/barbers/me/portfolio/certifications')
      .set('Authorization', `Bearer ${barberToken}`)
      .send({
        name: 'Barber License',
        issuer: 'Massachusetts Board',
        issueDate: '2023-01-01',
      });
    expect(certification.status).toBe(201);

    const publicPortfolio = await request(app).get(`/barbers/${barberId}/portfolio`);
    expect(publicPortfolio.status).toBe(200);
    expect(publicPortfolio.body).toMatchObject({
      items: [],
      experiences: [expect.objectContaining({ shopName: 'Elite Cuts' })],
      certifications: [expect.objectContaining({ name: 'Barber License' })],
      trust: { totalClients: 0 },
    });
    expect(JSON.stringify(publicPortfolio.body)).not.toContain('cloudinary_public_id');

    const incomplete = await request(app)
      .post('/barbers/me/portfolio/complete')
      .set('Authorization', `Bearer ${barberToken}`);
    expect(incomplete.status).toBe(422);
    expect(incomplete.body).toMatchObject({ code: 'PORTFOLIO_INCOMPLETE' });

    await request(app)
      .patch('/barbers/me/profile')
      .set('Authorization', `Bearer ${barberToken}`)
      .send({
        headline: 'Precision fades and textured hair',
        bio: 'A detail-focused barber for modern cuts.',
        yearsOfExperience: 7,
        languages: ['English'],
      });
    const completed = await request(app)
      .post('/barbers/me/portfolio/complete')
      .set('Authorization', `Bearer ${barberToken}`);
    expect(completed.status).toBe(200);
    const completedBody = completed.body as CompletedPortfolioBody;
    expect(typeof completedBody.portfolioCompletedAt).toBe('string');
  });
});
