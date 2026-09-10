/**
 * testDb.ts — Isolated Test Database Connection Pool
 *
 * ARCHITECTURE RULES (MANDATORY):
 *
 * 1. ALWAYS uses TEST_DATABASE_URL. Never falls back to DATABASE_URL.
 * 2. Fails loudly at import time if TEST_DATABASE_URL is missing.
 * 3. Safety gate: URL must contain "_test" — refuses to connect to non-test DB.
 * 4. Provides per-test transaction helpers for deterministic state isolation.
 * 5. The pool must be closed via closeTestPool() in afterAll() or test teardown.
 *
 * ISOLATION STRATEGY:
 * For tests that need clean state, use withTestTransaction():
 *   - Opens a transaction on a dedicated client
 *   - Yields the client to the test callback
 *   - ALWAYS rolls back after the callback, regardless of pass/fail
 *
 * For fixture creation (org, users, employees) that persist for a describe block:
 *   - Use createFixtures() / cleanupFixtures() with explicit DELETE in afterAll()
 *   - Use UUIDs prefixed with 'test-' to make fixture rows identifiable
 */
import path from 'path';
import dotenv from 'dotenv';
import { Pool, PoolClient } from 'pg';

// Load .env.test
dotenv.config({ path: path.join(__dirname, '../../../../.env.test') });

// ============================================================
// Safety Gate
// ============================================================
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

if (!TEST_DATABASE_URL) {
  throw new Error(
    '[testDb] FATAL: TEST_DATABASE_URL is not set.\n' +
    'The test suite will NEVER fall back to DATABASE_URL.\n' +
    'Run: node create-test-db.js && node seed-test-db.js'
  );
}

if (!TEST_DATABASE_URL.includes('_test') && !TEST_DATABASE_URL.includes('test_')) {
  throw new Error(
    `[testDb] FATAL SAFETY GATE: TEST_DATABASE_URL does not point to a test database.\n` +
    `URL: ${TEST_DATABASE_URL.replace(/:[^:@]+@/, ':***@')}\n` +
    `Database name must contain "_test". Refusing to proceed.`
  );
}

// ============================================================
// Test Pool — isolated from the application's runtime pool
// ============================================================
export const testPool = new Pool({
  connectionString: TEST_DATABASE_URL,
  ssl: false,
  max: 5, // Conservative pool size for sequential tests
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000
});

/**
 * Close the test pool. Call in afterAll() at the suite or global level.
 */
export async function closeTestPool(): Promise<void> {
  await testPool.end();
}

/**
 * Execute a callback inside a transaction that is ALWAYS rolled back.
 * Use for tests that would mutate data but must leave no trace.
 *
 * @param fn - Async callback receiving the pg PoolClient
 */
export async function withTestTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await testPool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('ROLLBACK');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Run a direct query against the test database for assertions.
 * Use sparingly — prefer testing through HTTP endpoints.
 */
export async function testQuery(sql: string, params?: any[]): Promise<any[]> {
  const result = await testPool.query(sql, params);
  return result.rows;
}

/**
 * Get the test database name from the connection URL.
 * Used to verify the database name in assertions.
 */
export function getTestDatabaseName(): string {
  const urlParts = TEST_DATABASE_URL!.split('/');
  return urlParts[urlParts.length - 1].split('?')[0];
}
