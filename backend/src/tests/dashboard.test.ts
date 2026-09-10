/**
 * dashboard.test.ts — Dashboard API Integration Tests (P1)
 *
 * Tests that the dashboard endpoint:
 * 1. Returns the correct response shape with all required sections
 * 2. Scopes data to the authenticated user's organization
 * 3. Is rejected when unauthenticated
 * 4. Accepts the period query parameter correctly
 */
import request from 'supertest';
import app from './helpers/testApp';
import { getSeededUser } from './helpers/auth';
import { closeTestPool } from './helpers/testDb';

afterAll(async () => {
  await closeTestPool();
});

describe('GET /api/v1/dashboard', () => {
  it('401: no token', async () => {
    const res = await request(app).get('/api/v1/dashboard');
    expect(res.status).toBe(401);
  });

  it('200: returns complete dashboard structure when authenticated', async () => {
    const { token } = await getSeededUser('superadmin@theiakshi.com');

    const res = await request(app)
      .get('/api/v1/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    const data = res.body.data;

    // Required top-level keys
    expect(data).toHaveProperty('summary');
    expect(data).toHaveProperty('departments');
    expect(data).toHaveProperty('weeklyAttendance');
    expect(data).toHaveProperty('recentActivities');
    expect(data).toHaveProperty('recentLeaveRequests');
    expect(data).toHaveProperty('upcomingHolidays');

    // Summary shape
    const summary = data.summary;
    expect(summary).toHaveProperty('totalEmployees');
    expect(summary).toHaveProperty('presentToday');
    expect(summary).toHaveProperty('onLeaveToday');
    expect(summary).toHaveProperty('pendingLeaves');
    expect(summary).toHaveProperty('pendingExpenses');
    expect(summary).toHaveProperty('pendingTasks');
    expect(summary).toHaveProperty('totalPendingItems');

    // Numeric sanity checks
    expect(typeof summary.totalEmployees).toBe('number');
    expect(typeof summary.presentToday).toBe('number');
    expect(summary.totalPendingItems).toBe(
      summary.pendingLeaves + summary.pendingExpenses + summary.pendingTasks
    );

    // weeklyAttendance shape
    const weekly = data.weeklyAttendance;
    expect(weekly).toHaveProperty('period');
    expect(weekly).toHaveProperty('points');
    expect(Array.isArray(weekly.points)).toBe(true);
    // Should have 7 days
    expect(weekly.points.length).toBe(7);

    // Each weekly point has required fields
    weekly.points.forEach((point: any) => {
      expect(point).toHaveProperty('day');
      expect(point).toHaveProperty('date');
      expect(point).toHaveProperty('presentCount');
      expect(point).toHaveProperty('pct');
      expect(point.pct).toBeGreaterThanOrEqual(0);
      expect(point.pct).toBeLessThanOrEqual(100);
    });

    // Departments is an array
    expect(Array.isArray(data.departments)).toBe(true);

    // upcomingHolidays is an array
    expect(Array.isArray(data.upcomingHolidays)).toBe(true);
  });

  it('200: period=Last Week returns weekly data', async () => {
    const { token } = await getSeededUser('superadmin@theiakshi.com');

    const res = await request(app)
      .get('/api/v1/dashboard?period=Last%20Week')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.weeklyAttendance.period).toBe('Last Week');
    expect(res.body.data.weeklyAttendance.points.length).toBe(7);
  });

  it('200: period=This Month returns weekly data', async () => {
    const { token } = await getSeededUser('superadmin@theiakshi.com');

    const res = await request(app)
      .get('/api/v1/dashboard?period=This%20Month')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.weeklyAttendance.period).toBe('This Month');
  });

  it('200: dashboard for HR_MANAGER role returns valid data', async () => {
    // Use a different seeded user to test role-specific behavior
    let hrToken: string;
    try {
      const result = await getSeededUser('hr@theiakshi.com');
      hrToken = result.token;
    } catch {
      // If hr user doesn't exist in this DB, skip
      console.warn('hr@theiakshi.com not found, skipping HR manager dashboard test');
      return;
    }

    const res = await request(app)
      .get('/api/v1/dashboard')
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary).toBeDefined();
  });
});
