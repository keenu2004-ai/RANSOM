/**
 * globalSetup.ts
 *
 * Runs ONCE before the entire Jest test suite.
 * Loads .env.test, validates TEST_DATABASE_URL, and enforces the safety gate
 * that prevents tests from ever running against a non-test database.
 *
 * This file runs in a separate Node.js context from tests, so it cannot
 * share module state. Its sole job is environment validation.
 */
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

export default async function globalSetup() {
  // Load .env.test — must exist
  const envTestPath = path.join(__dirname, '../../../.env.test');
  if (!fs.existsSync(envTestPath)) {
    throw new Error(
      `[FATAL] .env.test not found at ${envTestPath}.\n` +
      `Run 'node create-test-db.js && node seed-test-db.js' to provision the test database.`
    );
  }

  dotenv.config({ path: envTestPath });

  const testUrl = process.env.TEST_DATABASE_URL;

  if (!testUrl) {
    throw new Error(
      '[FATAL] TEST_DATABASE_URL is not set in .env.test.\n' +
      'The test suite refuses to run without an explicit TEST_DATABASE_URL.\n' +
      'It will NEVER fall back to DATABASE_URL.'
    );
  }

  // Safety gate: URL must reference a test database
  if (!testUrl.includes('_test') && !testUrl.includes('test_')) {
    throw new Error(
      `[FATAL] SAFETY GATE: TEST_DATABASE_URL does not look like a test database URL.\n` +
      `URL must contain "_test" in the database name.\n` +
      `Current URL: ${testUrl.replace(/:[^:@]+@/, ':***@')}\n` +
      `Refusing to run tests against what may be a production or development database.`
    );
  }

  // Propagate to process.env so ts-jest test files can read it
  process.env.TEST_DATABASE_URL = testUrl;
  // Set NODE_ENV to test
  process.env.NODE_ENV = 'test';

  console.log('\n[TEST SETUP] Environment validated:');
  console.log(`  NODE_ENV          = test`);
  console.log(`  TEST_DATABASE_URL = ${testUrl.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`  Safety gate       = PASSED (database name contains "_test")\n`);
}
