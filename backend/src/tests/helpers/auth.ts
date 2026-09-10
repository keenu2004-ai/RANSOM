/**
 * auth.ts — Test Authentication Helpers
 *
 * Provides typed helpers for:
 * - Signing valid/invalid/expired/stale JWT tokens
 * - Logging in via the real HTTP endpoint (gets real session cookie)
 * - Creating authenticated Supertest request helpers
 * - Creating/deactivating fixture test users in the test DB
 *
 * All token signing uses the REAL JWT_SECRET from .env.test so that
 * the authMiddleware's jwt.verify() accepts them.
 * Stale and wrong-secret tokens are created to test rejection paths.
 *
 * IMPORTANT: Login uses the seeded password 'ChangeMe@123' for demo accounts.
 * These accounts are seeded by seed-test-db.js.
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import request, { SuperTest, Test } from 'supertest';
import path from 'path';
import dotenv from 'dotenv';
import { testPool } from './testDb';

// Load .env.test for JWT_SECRET
dotenv.config({ path: path.join(__dirname, '../../../../.env.test') });

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('[auth helpers] FATAL: JWT_SECRET not set in .env.test');
}

// ============================================================
// Token signing utilities
// ============================================================

export interface TestTokenPayload {
  userId: string;
  organizationId: string;
  email: string;
  role: string;
  auth_version: number;
  employeeId?: string | null;
}

/** Sign a fully valid JWT that the middleware will accept (if auth_version matches DB). */
export function signToken(payload: TestTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: '1h' });
}

/** Sign a JWT with auth_version deliberately bumped to be stale. */
export function signStaleToken(payload: TestTokenPayload): string {
  return jwt.sign({ ...payload, auth_version: payload.auth_version + 9999 }, JWT_SECRET!, { expiresIn: '1h' });
}

/** Sign a JWT with 0s expiry so it's already expired. */
export function signExpiredToken(payload: TestTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: '0s' });
}

/** Sign a JWT with a completely wrong secret — must be rejected by jwt.verify(). */
export function signTokenWithWrongSecret(payload: object): string {
  return jwt.sign(payload, 'THIS_IS_WRONG_DO_NOT_USE', { expiresIn: '1h' });
}

/** Sign a token without an auth_version field — must be rejected by the middleware. */
export function signTokenMissingAuthVersion(payload: Omit<TestTokenPayload, 'auth_version'>): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: '1h' });
}

// ============================================================
// Session login helper (uses real HTTP endpoint)
// ============================================================

export interface LoginResult {
  token: string;
  cookies: string;
  user: any;
}

/**
 * Login via POST /api/v1/auth/login and return the JWT token and session cookie.
 * Uses the REAL endpoint — not a mock.
 */
export async function loginAs(
  app: any,
  email: string,
  password = 'ChangeMe@123'
): Promise<LoginResult> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });

  if (res.status !== 200) {
    throw new Error(
      `loginAs(${email}) failed with status ${res.status}: ${JSON.stringify(res.body)}`
    );
  }

  const setCookie = res.headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie || '');

  // Extract the raw token from the cookie string
  const match = cookies.match(/theiakshi_session=([^;]+)/);
  const token = match ? match[1] : '';

  return {
    token,
    cookies,
    user: res.body.data?.user
  };
}

// ============================================================
// Authenticated request helpers
// ============================================================

/** Returns a Supertest request with a Bearer Authorization header. */
export function bearerGet(app: any, path: string, token: string) {
  return request(app)
    .get(path)
    .set('Authorization', `Bearer ${token}`)
    .set('Accept', 'application/json');
}

export function bearerPost(app: any, path: string, token: string, body: object = {}) {
  return request(app)
    .post(path)
    .set('Authorization', `Bearer ${token}`)
    .set('Accept', 'application/json')
    .send(body);
}

export function bearerPut(app: any, path: string, token: string, body: object = {}) {
  return request(app)
    .put(path)
    .set('Authorization', `Bearer ${token}`)
    .set('Accept', 'application/json')
    .send(body);
}

/** Cookie-based GET — simulates a browser session. */
export function cookieGet(app: any, path: string, cookies: string) {
  return request(app)
    .get(path)
    .set('Cookie', cookies)
    .set('Accept', 'application/json');
}

/** Cookie-based POST with valid Origin header (should pass CSRF). */
export function cookiePost(
  app: any,
  path: string,
  cookies: string,
  body: object = {},
  origin = 'http://localhost:5173'
) {
  return request(app)
    .post(path)
    .set('Cookie', cookies)
    .set('Origin', origin)
    .set('Accept', 'application/json')
    .send(body);
}

/** Cookie-based POST WITHOUT Origin header — should trigger CSRF_FAILED. */
export function cookiePostNoOrigin(app: any, path: string, cookies: string, body: object = {}) {
  return request(app)
    .post(path)
    .set('Cookie', cookies)
    .set('Accept', 'application/json')
    .send(body);
}

// ============================================================
// DB fixture helpers
// ============================================================

export interface TestOrgFixture {
  orgId: string;
  orgCode: string;
}

export interface TestUserFixture {
  userId: string;
  orgId: string;
  email: string;
  role: string;
  auth_version: number;
  employeeId: string | null;
  token: string;
}

/**
 * Create an isolated test organization with a unique code.
 * Returns the orgId and code.
 * MUST be deleted in afterAll via deleteTestOrg().
 */
export async function createTestOrg(nameSuffix = 'TEST'): Promise<TestOrgFixture> {
  const orgCode = `TST-${nameSuffix}-${Date.now()}`;
  const result = await testPool.query(
    `INSERT INTO organizations (name, code, currency, default_hq)
     VALUES ($1, $2, 'INR', 'TST-HQ')
     RETURNING id`,
    [`Test Org ${nameSuffix}`, orgCode]
  );
  return { orgId: result.rows[0].id, orgCode };
}

/**
 * Create a test user with a given role inside an organization.
 * Uses bcrypt cost factor 4 (fast for tests).
 * Returns a fully formed TestUserFixture with a signed JWT.
 */
export async function createTestUser(opts: {
  orgId: string;
  email: string;
  role: 'SUPER_ADMIN' | 'HR_MANAGER' | 'OPERATIONAL_MANAGER' | 'EMPLOYEE';
  password?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}): Promise<TestUserFixture> {
  const password = opts.password || 'TestPassword@123';
  const passwordHash = await bcrypt.hash(password, 4); // Cost 4 — fast for tests

  // Create user
  const userResult = await testPool.query(
    `INSERT INTO users (organization_id, email, password_hash, status, auth_version)
     VALUES ($1, $2, $3, $4, 1)
     RETURNING id, auth_version`,
    [opts.orgId, opts.email, passwordHash, opts.status || 'ACTIVE']
  );
  const userId = userResult.rows[0].id;
  const auth_version = userResult.rows[0].auth_version;

  // Resolve role ID from the canonical roles table
  const roleResult = await testPool.query(
    `SELECT id FROM roles WHERE name = $1 LIMIT 1`,
    [opts.role]
  );
  if (roleResult.rows.length === 0) {
    throw new Error(`Role '${opts.role}' not found in test DB — ensure seed ran correctly`);
  }
  const roleId = roleResult.rows[0].id;

  // Assign role
  await testPool.query(
    `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
    [userId, roleId]
  );

  const token = signToken({
    userId,
    organizationId: opts.orgId,
    email: opts.email,
    role: opts.role,
    auth_version,
    employeeId: null
  });

  return {
    userId,
    orgId: opts.orgId,
    email: opts.email,
    role: opts.role,
    auth_version,
    employeeId: null,
    token
  };
}

/**
 * Create a test employee profile linked to a user.
 * Returns the employeeId.
 */
export async function createTestEmployee(opts: {
  orgId: string;
  userId: string;
  deptId?: string | null;
  employeeCode?: string;
}): Promise<string> {
  const code = opts.employeeCode || `TST-EMP-${Date.now()}`;

  // Get or create a department
  let deptId = opts.deptId;
  if (!deptId) {
    const deptRes = await testPool.query(
      `INSERT INTO departments (organization_id, name, code) VALUES ($1, $2, $3) RETURNING id`,
      [opts.orgId, 'Test Department', `TST-DEPT-${Date.now()}`]
    );
    deptId = deptRes.rows[0].id;
  }

  const result = await testPool.query(
    `INSERT INTO employees (organization_id, user_id, employee_code, first_name, last_name, email, status, department_id, branch_id)
     VALUES ($1, $2, $3, 'Test', 'Employee', (SELECT email FROM users WHERE id = $2), 'ACTIVE', $4,
       (SELECT id FROM branches WHERE organization_id = $1 LIMIT 1))
     RETURNING id`,
    [opts.orgId, opts.userId, code, deptId]
  );
  return result.rows[0].id;
}

/**
 * Deactivate a test user by setting status = INACTIVE and bumping auth_version.
 * This invalidates all existing tokens for that user.
 */
export async function deactivateTestUser(userId: string): Promise<void> {
  await testPool.query(
    `UPDATE users SET status = 'INACTIVE', auth_version = auth_version + 1 WHERE id = $1`,
    [userId]
  );
}

/**
 * Delete all rows created for a test org. Cascades via FK constraints.
 * Call this in afterAll() to clean up fixture data.
 */
export async function deleteTestOrg(orgId: string): Promise<void> {
  await testPool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
}

/**
 * Delete a specific test user (and cascade to user_roles etc.)
 */
export async function deleteTestUser(userId: string): Promise<void> {
  await testPool.query(`DELETE FROM users WHERE id = $1`, [userId]);
}

/**
 * Load an existing seeded user and create a signed token.
 * Uses read-only DB query — does NOT mutate state.
 * For use with pre-seeded accounts (superadmin, hr, manager, employee).
 */
export async function getSeededUser(email: string): Promise<TestUserFixture> {
  const result = await testPool.query(
    `SELECT u.id, u.organization_id, u.auth_version, u.status,
            r.name as role,
            e.id as employee_id
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     LEFT JOIN employees e ON e.user_id = u.id AND e.organization_id = u.organization_id
     WHERE u.email = $1
     LIMIT 1`,
    [email]
  );

  if (result.rows.length === 0) {
    throw new Error(
      `Seeded user '${email}' not found in test DB.\n` +
      `Ensure you have run: node seed-test-db.js`
    );
  }

  const row = result.rows[0];
  const token = signToken({
    userId: row.id,
    organizationId: row.organization_id,
    email,
    role: row.role || 'EMPLOYEE',
    auth_version: row.auth_version || 1,
    employeeId: row.employee_id || null
  });

  return {
    userId: row.id,
    orgId: row.organization_id,
    email,
    role: row.role || 'EMPLOYEE',
    auth_version: row.auth_version || 1,
    employeeId: row.employee_id || null,
    token
  };
}
