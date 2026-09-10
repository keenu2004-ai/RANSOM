// Seed the test database using TEST_DATABASE_URL
// Usage: node seed-test-db.js
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env.test') });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  console.error('❌ FATAL: TEST_DATABASE_URL is not set in .env.test');
  process.exit(1);
}

if (!testUrl.includes('theiakshi_test') && !testUrl.includes('_test')) {
  console.error('❌ SAFETY GATE: TEST_DATABASE_URL does not point to a test database!');
  console.error('   URL must contain "_test" to proceed. Refusing to run on non-test DB.');
  process.exit(1);
}

// Override DATABASE_URL so the migration/seed scripts use the test DB
process.env.DATABASE_URL = testUrl;
process.env.DATABASE_SSL = 'false';

const { runSeed } = require('../database/scripts/seed.js');

runSeed()
  .then(() => {
    console.log('\n✅ Test database seeded successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Test database seed failed:', err.message);
    process.exit(1);
  });
