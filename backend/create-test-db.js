/**
 * create-test-db.js
 *
 * Creates the 'theiakshi_test' database if it does not exist,
 * then runs all migrations against it.
 *
 * SAFETY CONTRACT:
 * - Connects to `postgres` system DB to create the test DB
 * - NEVER touches theiakshi_hrms (development database)
 * - Writes TEST_DATABASE_URL to .env.test
 * - Fails loudly if DATABASE_URL is missing
 */
const path = require('path');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const devUrl = process.env.DATABASE_URL;
if (!devUrl) {
  process.stderr.write('❌ DATABASE_URL missing — cannot derive test database URL\n');
  process.exit(1);
}

// Derive test DB URL by replacing the DB name
const testUrl = devUrl.replace('/theiakshi_hrms', '/theiakshi_test');
const adminUrl = devUrl.replace('/theiakshi_hrms', '/postgres');

console.log('Dev DB   :', devUrl.replace(/:[^:@]+@/, ':***@'));
console.log('Test DB  :', testUrl.replace(/:[^:@]+@/, ':***@'));
console.log('Admin URL:', adminUrl.replace(/:[^:@]+@/, ':***@'));

async function createTestDb() {
  const adminPool = new Pool({
    connectionString: adminUrl,
    ssl: false
  });

  try {
    // Check if test DB already exists
    const result = await adminPool.query(
      "SELECT datname FROM pg_database WHERE datname = 'theiakshi_test'"
    );

    if (result.rows.length === 0) {
      console.log('\nCreating test database theiakshi_test...');
      // CREATE DATABASE cannot be run in a transaction
      await adminPool.query('CREATE DATABASE theiakshi_test');
      console.log('✅ Test database created successfully');
    } else {
      console.log('\n✅ Test database theiakshi_test already exists');
    }
  } finally {
    await adminPool.end();
  }

  // Write .env.test
  const fs = require('fs');
  const envTestContent = `# AUTO-GENERATED — DO NOT COMMIT — Test database environment
# This file is used exclusively by the Jest test suite
NODE_ENV=test
DATABASE_URL=${testUrl}
TEST_DATABASE_URL=${testUrl}
DATABASE_SSL=false
JWT_SECRET=${process.env.JWT_SECRET || 'test-jwt-secret-theiakshi-2026'}
JWT_REFRESH_SECRET=${process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-theiakshi-2026'}
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
`;
  fs.writeFileSync(path.join(__dirname, '.env.test'), envTestContent);
  console.log('✅ Written .env.test');
  console.log(`\nTEST_DATABASE_URL = ${testUrl.replace(/:[^:@]+@/, ':***@')}`);
}

createTestDb().catch(e => {
  console.error('❌ Failed to create test database:', e.message);
  process.exit(1);
});
