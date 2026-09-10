/**
 * health.test.ts — Health Check and Infrastructure Tests
 *
 * Tests that:
 * 1. /api/v1/health responds correctly (public endpoint)
 * 2. Route namespacing enforces /api/v1/* not /api/*
 * 3. Response structure is correct
 * 4. Malformed JSON returns 400 not 500
 *
 * These are the fastest integration tests and should always pass.
 */
import request from 'supertest';
import app from './helpers/testApp';
import { closeTestPool } from './helpers/testDb';

afterAll(async () => {
  await closeTestPool();
});

describe('GET /api/v1/health', () => {
  it('200: health check is publicly accessible', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns JSON content-type', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

describe('API route namespacing', () => {
  it('/api/v1/* routes are mounted (not /api/*)', async () => {
    // A route under /api/employees (old namespace) should 404
    const oldRes = await request(app).get('/api/employees');
    expect(oldRes.status).toBe(404);

    // /api/v1/employees without auth should 401 (route exists but requires auth)
    const newRes = await request(app).get('/api/v1/employees');
    expect(newRes.status).toBe(401);
  });

  it('404 for completely unknown routes', async () => {
    const res = await request(app).get('/totally-unknown-route-xyz');
    expect(res.status).toBe(404);
  });
});

describe('Error response format consistency', () => {
  it('404 routes return non-500 response', async () => {
    const res = await request(app)
      .get('/unknown-route')
      .set('Accept', 'application/json');
    expect(res.status).toBeLessThan(500);
  });

  it('POST with malformed JSON body returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ this is not valid json {{{{');

    // Express body-parser will reject this as 400
    expect(res.status).toBe(400);
  });
});
