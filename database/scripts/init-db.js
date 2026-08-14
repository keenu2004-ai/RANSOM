/**
 * THEIAKSHI ENTERPRISE HRMS — DATABASE INITIALIZATION SCRIPT
 * Runs migration and pre-checks database connection.
 */

const { runMigrations } = require('./migrate');

async function initDb() {
  console.log('====================================================');
  console.log('  THEIAKSHI ENTERPRISE HRMS — DATABASE INITIALIZATION');
  console.log('====================================================');

  try {
    await runMigrations();
    console.log('✅ Database initialization complete.');
  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  initDb();
}

module.exports = { initDb };
