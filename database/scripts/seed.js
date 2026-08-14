/**
 * THEIAKSHI ENTERPRISE HRMS — IDEMPOTENT DATABASE SEED RUNNER
 * Seeds master baseline data, permissions matrix, and 5 demo accounts.
 */

const fs = require('fs');
const path = require('path');
let Pool;
try {
  Pool = require('pg').Pool;
} catch (e) {
  Pool = require(path.join(__dirname, '../../backend/node_modules/pg')).Pool;
}

try {
  require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });
} catch (e) {}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ ERROR: DATABASE_URL environment variable is missing.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false }
});

async function runSeed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding PostgreSQL database with idempotent baseline data...');
    const seedPath = path.join(__dirname, '../seeds/001_baseline.sql');
    
    if (!fs.existsSync(seedPath)) {
      throw new Error(`Seed SQL file not found at ${seedPath}`);
    }

    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await client.query(seedSql);

    console.log('✅ Baseline seed executed successfully!');
    console.log('----------------------------------------------------');
    console.log('Demo Accounts Initialized (Password: ChangeMe@123):');
    console.log(' 1. SUPER_ADMIN: superadmin@theiakshi.com (Employee: NONE)');
    console.log(' 2. ADMIN:       admin@theiakshi.com      (Employee: NONE)');
    console.log(' 3. HR_MANAGER:  hr@theiakshi.com         (Employee: EMP-001)');
    console.log(' 4. MANAGER:     manager@theiakshi.com    (Employee: EMP-002)');
    console.log(' 5. EMPLOYEE:    employee@theiakshi.com   (Employee: EMP-003)');
    console.log('----------------------------------------------------');
  } catch (error) {
    console.error('❌ SEED ERROR:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runSeed();
}

module.exports = { runSeed };
