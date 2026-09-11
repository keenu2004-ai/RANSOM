/**
 * attendance_regularization_concurrency.test.ts
 *
 * Tests the /api/v1/attendance/regularize endpoints for:
 * 1. Concurrency: Ensuring only one terminal state decision can succeed.
 */
import request from 'supertest';
import app from './helpers/testApp';
import { getSeededUser } from './helpers/auth';
import { query } from '../db';
import { closeTestPool } from './helpers/testDb';

afterAll(async () => {
  await closeTestPool();
});

describe('Regularization State Machine Concurrency', () => {
  let employeeToken: string;
  let hrToken: string;
  let organizationId: string;
  let employeeId: string;

  beforeAll(async () => {
    // Get HR token
    const hr = await getSeededUser('hr@theiakshi.com');
    hrToken = hr.token;
    const orgRes = await query('SELECT organization_id FROM users WHERE id = $1', [hr.userId]);
    organizationId = orgRes.rows[0].organization_id;

    // Get Employee token
    const emp = await getSeededUser('employee@theiakshi.com');
    employeeToken = emp.token;
    employeeId = emp.employeeId ?? '';
  });

  it('Only one terminal decision (approve/reject) succeeds when processed concurrently', async () => {
    if (!employeeId || !organizationId) {
      console.warn('Skipping test due to missing seeded data');
      return;
    }

    // 1. Create a pending regularization request directly via DB to bypass validation dates
    const dateStr = new Date().toISOString().split('T')[0];
    const insertRes = await query(`
      INSERT INTO attendance_regularizations (
        organization_id, employee_id, attendance_date,
        attendance_type, reason, status, submitted_by
      ) VALUES ($1, $2, $3, 'PRESENT', 'Forgot to punch in', 'PENDING', $2)
      RETURNING id
    `, [organizationId, employeeId, dateStr]);

    const regId = insertRes.rows[0].id;

    // 2. Fire 3 concurrent approve/reject requests
    const promises = [
      request(app).put(`/api/v1/attendance/regularize/${regId}`).set('Authorization', `Bearer ${hrToken}`).send({ action: 'APPROVE' }),
      request(app).put(`/api/v1/attendance/regularize/${regId}`).set('Authorization', `Bearer ${hrToken}`).send({ action: 'REJECT', rejectionReason: 'Nope' }),
      request(app).put(`/api/v1/attendance/regularize/${regId}`).set('Authorization', `Bearer ${hrToken}`).send({ action: 'APPROVE' })
    ];

    const results = await Promise.all(promises);

    // 3. Count successful responses
    // 200 OK means success. 400 or 500 means failed due to state mismatch
    const successes = results.filter(r => r.status === 200 || r.status === 201);
    const failures = results.filter(r => r.status >= 400);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(2);

    // Verify error messages for failures contain 'already processed'
    failures.forEach(f => {
      expect(f.body.error).toMatch(/not found or already processed/i);
    });

    // 4. Verify DB state is terminal
    const finalState = await query(`SELECT status FROM attendance_regularizations WHERE id = $1`, [regId]);
    expect(['APPROVED', 'REJECTED']).toContain(finalState.rows[0].status);
  });
});
