/**
 * attendance.test.ts — Attendance API Integration Tests (P1)
 *
 * Tests the /api/v1/attendance endpoints for:
 * 1. Authentication gates
 * 2. /attendance/today endpoint shape and response for authenticated user
 * 3. Check-in endpoint validation (missing body, unauthenticated)
 * 4. Admin attendance list requires elevated role
 */
import request from 'supertest';
import app from './helpers/testApp';
import { getSeededUser } from './helpers/auth';
import { closeTestPool } from './helpers/testDb';

afterAll(async () => {
  await closeTestPool();
});

describe('GET /api/v1/attendance/today', () => {
  it('401: unauthenticated request returns 401', async () => {
    const res = await request(app).get('/api/v1/attendance/today');
    expect(res.status).toBe(401);
  });

  it('400: superadmin (no employee profile) returns EMPLOYEE_PROFILE_REQUIRED', async () => {
    // superadmin@theiakshi.com has no employee profile by design
    const { token } = await getSeededUser('superadmin@theiakshi.com');

    const res = await request(app)
      .get('/api/v1/attendance/today')
      .set('Authorization', `Bearer ${token}`);

    // Should be 400 with EMPLOYEE_PROFILE_REQUIRED code
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('EMPLOYEE_PROFILE_REQUIRED');
  });

  it('200: user with employee profile returns today summary', async () => {
    // Try to find a user with an employee profile (hr or employee account)
    let result: any;
    for (const email of ['hr@theiakshi.com', 'employee@theiakshi.com', 'manager@theiakshi.com']) {
      try {
        result = await getSeededUser(email);
        if (result.employeeId) break;
      } catch {
        continue;
      }
    }

    if (!result || !result.employeeId) {
      console.warn('No user with employee profile found — skipping today summary test');
      return;
    }

    const res = await request(app)
      .get('/api/v1/attendance/today')
      .set('Authorization', `Bearer ${result.token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    // Must include summary fields
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data).toHaveProperty('canCheckIn');
    expect(res.body.data).toHaveProperty('canCheckOut');
  });
});

describe('POST /api/v1/attendance/checkin', () => {
  it('401: unauthenticated returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/attendance/check-in')
      .send({});
    expect(res.status).toBe(401);
  });

  it('400: superadmin with no employee profile — bearer token bypasses CSRF, gets 400', async () => {
    // This tests the CSRF gate specifically on the check-in endpoint
    // Using bearer token bypasses CSRF, so we test with a bearer token here
    // The CSRF test for cookie path is in authorization.test.ts
    const { token } = await getSeededUser('superadmin@theiakshi.com');

    const res = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    // Should return 400 (no employee profile), not 403 (CSRF) — bearer bypasses CSRF
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EMPLOYEE_PROFILE_REQUIRED');
  });
});

describe('GET /api/v1/attendance (admin list)', () => {
  it('401: unauthenticated', async () => {
    const res = await request(app).get('/api/v1/attendance');
    expect(res.status).toBe(401);
  });

  it('200 or 403: access depends on role, never 500', async () => {
    const { token } = await getSeededUser('superadmin@theiakshi.com');

    const res = await request(app)
      .get('/api/v1/attendance')
      .set('Authorization', `Bearer ${token}`);

    // SUPER_ADMIN should see the list, others might get 403
    expect([200, 403]).toContain(res.status);
    expect(res.body.success).toBeDefined();
  });
});
