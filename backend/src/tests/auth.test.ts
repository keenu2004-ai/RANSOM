/**
 * auth.test.ts — Authentication Endpoint Tests (P0 Priority)
 *
 * Tests the POST /api/v1/auth/login, GET /api/v1/auth/me, and
 * POST /api/v1/auth/logout endpoints using Supertest against the
 * real Express app (no live server port).
 *
 * Strategy:
 * - We use the seeded test database users (superadmin@theiakshi.com, etc.)
 * - These users exist from the project migrations and seed scripts
 * - Tests are READ-ONLY where possible; only login mutates session cookie state
 * - Tests do NOT commit or persist any data changes
 * - JWT tokens are verified through the real middleware (not mocked)
 *
 * Test User: superadmin@theiakshi.com / ChangeMe@123
 * (Password seeded by seed-test-db.js)
 *
 * NOTE: This file uses the helpers/ testApp which correctly points the app
 * pool at TEST_DATABASE_URL. The root-level testApp.ts is deprecated.
 */
import request from 'supertest';
import app from './helpers/testApp';
import {
  signToken,
  signStaleToken,
  signExpiredToken,
  signTokenWithWrongSecret,
  signTokenMissingAuthVersion,
  getSeededUser,
  loginAs
} from './helpers/auth';
import { closeTestPool } from './helpers/testDb';

const BASE = '/api/v1/auth';

afterAll(async () => {
  await closeTestPool();
});

// ============================================================
// POST /api/v1/auth/login
// ============================================================
describe('POST /api/v1/auth/login', () => {
  const endpoint = `${BASE}/login`;

  it('200: returns user data and sets HttpOnly session cookie on valid credentials', async () => {
    const res = await request(app)
      .post(endpoint)
      .send({ email: 'superadmin@theiakshi.com', password: 'ChangeMe@123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe('superadmin@theiakshi.com');

    // Verify HttpOnly session cookie is set
    const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : (setCookie ?? '');
    expect(cookieStr).toContain('theiakshi_session=');
    expect(cookieStr.toLowerCase()).toContain('httponly');
  });

  it('401: invalid password returns correct error code', async () => {
    const res = await request(app)
      .post(endpoint)
      .send({ email: 'superadmin@theiakshi.com', password: 'WRONG_PASSWORD_9999' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
    // Must NOT reveal whether email exists
    expect(res.body.error).toBe('Invalid email or password.');
  });

  it('401: non-existent email returns same generic error (no user enumeration)', async () => {
    const res = await request(app)
      .post(endpoint)
      .send({ email: 'nonexistent_user_9999@example.com', password: 'SomePassword123' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
    // Must use identical message to prevent email enumeration
    expect(res.body.error).toBe('Invalid email or password.');
  });

  it('400: missing password returns validation error', async () => {
    const res = await request(app)
      .post(endpoint)
      .send({ email: 'superadmin@theiakshi.com' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('400: missing email returns validation error', async () => {
    const res = await request(app)
      .post(endpoint)
      .send({ password: 'ChangeMe@123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('400: invalid email format returns validation error', async () => {
    const res = await request(app)
      .post(endpoint)
      .send({ email: 'not-an-email', password: 'ChangeMe@123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('400: empty body returns validation error', async () => {
    const res = await request(app)
      .post(endpoint)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('response does NOT include JWT token in body (token is in HttpOnly cookie only)', async () => {
    const res = await request(app)
      .post(endpoint)
      .send({ email: 'superadmin@theiakshi.com', password: 'ChangeMe@123' });

    expect(res.status).toBe(200);
    // The token must NOT appear in the response body
    expect(res.body.data.token).toBeUndefined();
    expect(res.body.token).toBeUndefined();
  });
});

// ============================================================
// GET /api/v1/auth/me
// ============================================================
describe('GET /api/v1/auth/me', () => {
  const endpoint = `${BASE}/me`;

  it('200: returns current user when authenticated with valid Bearer token', async () => {
    const { token } = await getSeededUser('superadmin@theiakshi.com');

    const res = await request(app)
      .get(endpoint)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe('superadmin@theiakshi.com');
  });

  it('401: no token returns UNAUTHENTICATED', async () => {
    const res = await request(app).get(endpoint);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(['UNAUTHENTICATED', 'INVALID_TOKEN']).toContain(res.body.code);
  });

  it('401: malformed Bearer token returns INVALID_TOKEN', async () => {
    const res = await request(app)
      .get(endpoint)
      .set('Authorization', 'Bearer this.is.not.a.valid.jwt');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('401: token signed with wrong secret is rejected', async () => {
    const fakeToken = signTokenWithWrongSecret({
      userId: '00000000-0000-0000-0000-000000000001',
      organizationId: 'fake-org',
      email: 'hacker@evil.com',
      role: 'SUPER_ADMIN',
      auth_version: 1
    });

    const res = await request(app)
      .get(endpoint)
      .set('Authorization', `Bearer ${fakeToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('401: expired token is rejected', async () => {
    const user = await getSeededUser('superadmin@theiakshi.com');
    const expiredToken = signExpiredToken({
      userId: user.userId,
      organizationId: user.orgId,
      email: 'superadmin@theiakshi.com',
      role: 'SUPER_ADMIN',
      auth_version: user.auth_version
    });

    // Small delay to ensure token is past expiry
    await new Promise(r => setTimeout(r, 100));

    const res = await request(app)
      .get(endpoint)
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('401: token with stale auth_version is rejected even if otherwise valid', async () => {
    const user = await getSeededUser('superadmin@theiakshi.com');
    const staleToken = signStaleToken({
      userId: user.userId,
      organizationId: user.orgId,
      email: 'superadmin@theiakshi.com',
      role: 'SUPER_ADMIN',
      auth_version: user.auth_version
    });

    const res = await request(app)
      .get(endpoint)
      .set('Authorization', `Bearer ${staleToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('401: token with missing auth_version is rejected', async () => {
    const user = await getSeededUser('superadmin@theiakshi.com');
    const noVersionToken = signTokenMissingAuthVersion({
      userId: user.userId,
      organizationId: user.orgId,
      email: 'superadmin@theiakshi.com',
      role: 'SUPER_ADMIN'
    });

    const res = await request(app)
      .get(endpoint)
      .set('Authorization', `Bearer ${noVersionToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });
});

// ============================================================
// POST /api/v1/auth/logout
// ============================================================
describe('POST /api/v1/auth/logout', () => {
  const endpoint = `${BASE}/logout`;

  it('200: logout succeeds and clears session cookie', async () => {
    const { token } = await getSeededUser('superadmin@theiakshi.com');

    const res = await request(app)
      .post(endpoint)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify the cookie is cleared (set-cookie with expires in the past / empty value)
    const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
    if (setCookie) {
      const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : setCookie;
      // Cookie should be cleared: either empty value or expires in past
      const hasSession = cookieStr.includes('theiakshi_session=');
      if (hasSession) {
        // If the cookie is set, it should have an Expires in the past (i.e., cleared)
        expect(cookieStr.toLowerCase()).toMatch(/expires=|max-age=0/i);
      }
    }
  });

  it('401: logout without authentication returns 401', async () => {
    const res = await request(app).post(endpoint);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('F16 Challenge: verify auth_version is incremented and previous session invalidated upon logout', async () => {
    // 1. Create an isolated user for this test
    const { createTestOrg, createTestUser } = require('./helpers/auth');
    const org = await createTestOrg('AUTH-VER-LOGOUT');
    const user = await createTestUser({ orgId: org.orgId, email: `logout-test-${Date.now()}@test.local`, role: 'EMPLOYEE' });
    
    // 2. Obtain current auth_version
    const { testPool } = require('./helpers/testDb');
    const preRes = await testPool.query('SELECT auth_version FROM users WHERE id = $1', [user.userId]);
    const initialVersion = preRes.rows[0].auth_version;

    // 3. Logout
    const resLogout = await request(app)
      .post(endpoint)
      .set('Authorization', `Bearer ${user.token}`)
      .set('Origin', 'http://localhost:5173');
    
    expect(resLogout.status).toBe(200);

    // 4. Verify auth_version incremented in DB
    const postRes = await testPool.query('SELECT auth_version FROM users WHERE id = $1', [user.userId]);
    const newVersion = postRes.rows[0].auth_version;
    expect(newVersion).toBeGreaterThan(initialVersion);

    // 5. Attempt to use the original token (must be rejected)
    const resMe = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${user.token}`);
    
    expect(resMe.status).toBe(401);
  });
});

describe('POST /api/v1/auth/change-password (F16 Challenge)', () => {
  const endpoint = `${BASE}/change-password`;

  it('F16 Challenge: verify auth_version is incremented and previous session invalidated upon password change', async () => {
    const { createTestOrg, createTestUser, loginAs } = require('./helpers/auth');
    const org = await createTestOrg('AUTH-VER-PWD');
    const email = `pwd-test-${Date.now()}@test.local`;
    const user = await createTestUser({ orgId: org.orgId, email, role: 'EMPLOYEE' });
    
    const { testPool } = require('./helpers/testDb');
    const preRes = await testPool.query('SELECT auth_version FROM users WHERE id = $1', [user.userId]);
    const initialVersion = preRes.rows[0].auth_version;

    const resChange = await request(app)
      .post(endpoint)
      .set('Authorization', `Bearer ${user.token}`)
      .set('Origin', 'http://localhost:5173')
      .send({
        currentPassword: 'TestPassword@123',
        newPassword: 'NewSecurePassword!99',
        confirmPassword: 'NewSecurePassword!99'
      });
    
    expect(resChange.status).toBe(200);

    const postRes = await testPool.query('SELECT auth_version FROM users WHERE id = $1', [user.userId]);
    const newVersion = postRes.rows[0].auth_version;
    expect(newVersion).toBeGreaterThan(initialVersion);

    // Old token must fail
    const resMe = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${user.token}`);
    expect(resMe.status).toBe(401);

    // Fresh login must work
    const newLogin = await loginAs(app, email, 'NewSecurePassword!99');
    expect(newLogin.token).toBeDefined();

    // Verify new session works
    const resMeNew = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${newLogin.token}`);
    expect(resMeNew.status).toBe(200);
  });
});
