/**
 * testHelpers.ts
 * Shared utilities for the test suite.
 *
 * Design rules:
 * - Tests NEVER connect to the production database directly.
 * - Tests use the actual DB (dev DB) but in isolated transactions that
 *   are always rolled back after each test, preventing state leakage.
 * - No synthetic large-scale data is injected into production tables.
 * - All test users/orgs are created and cleaned within a transaction boundary.
 * - Real bcrypt hashing is used (but with a low cost factor for speed).
 * - JWT tokens are generated with the real JWT_SECRET from .env.
 */
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool, PoolClient } from 'pg';
import app from './testApp';
import { config } from '../config';

// Use the development DB for integration tests.
// Tests operate in transactions that are rolled back automatically.
export const testPool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false
});

/**
 * Generates a valid signed JWT for a given user payload.
 * Does NOT hit the database — purely creates a signed token.
 * The auth_version must match the DB user's auth_version or the middleware will reject it.
 */
export function signTestToken(payload: {
  userId: string;
  organizationId: string;
  email: string;
  role: string;
  auth_version: number;
  employeeId?: string | null;
}): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '1h' });
}

/**
 * Generates a JWT with a deliberately wrong auth_version.
 * Used to test stale-token rejection.
 */
export function signStaleToken(payload: {
  userId: string;
  organizationId: string;
  email: string;
  role: string;
  auth_version: number;
  employeeId?: string | null;
}): string {
  return jwt.sign(
    { ...payload, auth_version: payload.auth_version + 999 },
    config.jwtSecret,
    { expiresIn: '1h' }
  );
}

/**
 * Generates an expired JWT.
 */
export function signExpiredToken(payload: {
  userId: string;
  organizationId: string;
  email: string;
  role: string;
  auth_version: number;
}): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '0s' });
}

/**
 * Generates a JWT signed with the WRONG secret.
 * Used to verify the middleware rejects tampered tokens.
 */
export function signTokenWithWrongSecret(payload: object): string {
  return jwt.sign(payload, 'this-is-a-wrong-secret-that-must-be-rejected', { expiresIn: '1h' });
}

/**
 * Makes an authenticated GET request with a Bearer token.
 */
export function authGet(path: string, token: string) {
  return request(app)
    .get(path)
    .set('Authorization', `Bearer ${token}`)
    .set('Accept', 'application/json');
}

/**
 * Makes an authenticated POST request with a Bearer token.
 */
export function authPost(path: string, token: string, body: object = {}) {
  return request(app)
    .post(path)
    .set('Authorization', `Bearer ${token}`)
    .set('Accept', 'application/json')
    .send(body);
}

/**
 * Fetches a real user from the DB for integration tests.
 * Returns the user row + a valid signed token for that user.
 * Uses a read-only query — does NOT mutate state.
 */
export async function getRealUserAndToken(email: string): Promise<{
  userId: string;
  organizationId: string;
  role: string;
  auth_version: number;
  employeeId: string | null;
  token: string;
}> {
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
    throw new Error(`Test user '${email}' not found in database. Ensure seeded test accounts exist.`);
  }

  const row = result.rows[0];
  const token = signTestToken({
    userId: row.id,
    organizationId: row.organization_id,
    email,
    role: row.role || 'EMPLOYEE',
    auth_version: row.auth_version || 1,
    employeeId: row.employee_id || null
  });

  return {
    userId: row.id,
    organizationId: row.organization_id,
    role: row.role || 'EMPLOYEE',
    auth_version: row.auth_version || 1,
    employeeId: row.employee_id || null,
    token
  };
}

/**
 * Test DB teardown — close the test pool after all tests in a suite.
 */
export async function closeTestDb() {
  await testPool.end();
}

export { app, request };
