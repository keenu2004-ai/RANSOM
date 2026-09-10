/**
 * leave.test.ts — Leave API Integration Tests (P1)
 *
 * Tests:
 * 1. Auth gates on leave endpoints
 * 2. SUPER_ADMIN can retrieve leave list (org-scoped)
 * 3. Leave response shape validation
 * 4. Leave creation validation (400 on bad input)
 */
import request from 'supertest';
import app from './helpers/testApp';
import { getSeededUser } from './helpers/auth';
import { closeTestPool } from './helpers/testDb';

afterAll(async () => {
  await closeTestPool();
});

describe('GET /api/v1/leaves', () => {
  it('401: unauthenticated', async () => {
    const res = await request(app).get('/api/v1/leaves');
    expect(res.status).toBe(401);
  });

  it('200: authenticated SUPER_ADMIN can list leaves', async () => {
    const { token } = await getSeededUser('superadmin@theiakshi.com');

    const res = await request(app)
      .get('/api/v1/leaves')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('200: leave list response contains pagination or array', async () => {
    const { token } = await getSeededUser('superadmin@theiakshi.com');

    const res = await request(app)
      .get('/api/v1/leaves')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    // Should have either an array or pagination structure
    const hasArray = Array.isArray(data) || Array.isArray(data.leaves) || Array.isArray(data.requests);
    const hasPagination = data.total !== undefined || data.pagination !== undefined;
    expect(hasArray || hasPagination).toBe(true);
  });
});

describe('GET /api/v1/leaves/me/balance', () => {
  it('401: unauthenticated', async () => {
    const res = await request(app).get('/api/v1/leaves/me/balance');
    expect(res.status).toBe(401);
  });

  it('200 or 400: authenticated user gets balance or profile required error', async () => {
    const { token } = await getSeededUser('superadmin@theiakshi.com');

    const res = await request(app)
      .get('/api/v1/leaves/me/balance')
      .set('Authorization', `Bearer ${token}`);

    // SUPER_ADMIN has no employee profile, so may get 400 EMPLOYEE_PROFILE_REQUIRED
    // Or 200 with empty balance
    expect([200, 400]).toContain(res.status);
  });
});

describe('POST /api/v1/leaves/apply', () => {
  it('401: unauthenticated cannot apply for leave', async () => {
    const res = await request(app)
      .post('/api/v1/leaves/apply')
      .send({});
    expect(res.status).toBe(401);
  });

  it('400: authenticated but missing required fields returns validation error', async () => {
    let result: any;
    for (const email of ['hr@theiakshi.com', 'employee@theiakshi.com']) {
      try {
        result = await getSeededUser(email);
        if (result.employeeId) break;
      } catch { continue; }
    }

    if (!result || !result.employeeId) {
      console.warn('No employee user found — skipping leave apply validation test');
      return;
    }

    const res = await request(app)
      .post('/api/v1/leaves/apply')
      .set('Authorization', `Bearer ${result.token}`)
      .send({}); // Empty body = validation error

    // Should be 400 due to missing required fields
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
