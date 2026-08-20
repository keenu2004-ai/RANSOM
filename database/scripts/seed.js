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

const { runMigrations } = require('./migrate');

async function runSeed(skipMigrations = false) {
  // Ensure schema DDL and migrations execute first
  if (!skipMigrations) {
    await runMigrations();
  }

  const client = await pool.connect();
  try {
    console.log('🌱 Seeding PostgreSQL database with idempotent baseline data...');
    const seedPath = path.join(__dirname, '../seeds/001_baseline.sql');
    
    if (!fs.existsSync(seedPath)) {
      throw new Error(`Seed SQL file not found at ${seedPath}`);
    }

    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await client.query(seedSql);

    // Automated Seed Foreign Key Referential Integrity Check
    const checks = [
      {
        name: 'assets.category_id -> asset_categories.id',
        sql: `SELECT COUNT(*) FROM assets a LEFT JOIN asset_categories c ON c.id = a.category_id WHERE a.category_id IS NOT NULL AND c.id IS NULL`
      },
      {
        name: 'assets.organization_id -> organizations.id',
        sql: `SELECT COUNT(*) FROM assets a LEFT JOIN organizations o ON o.id = a.organization_id WHERE a.organization_id IS NOT NULL AND o.id IS NULL`
      },
      {
        name: 'assets.assigned_employee_id -> employees.id',
        sql: `SELECT COUNT(*) FROM assets a LEFT JOIN employees e ON e.id = a.assigned_employee_id WHERE a.assigned_employee_id IS NOT NULL AND e.id IS NULL`
      },
      {
        name: 'employees.user_id -> users.id',
        sql: `SELECT COUNT(*) FROM employees e LEFT JOIN users u ON u.id = e.user_id WHERE e.user_id IS NOT NULL AND u.id IS NULL`
      }
    ];

    for (const check of checks) {
      const res = await client.query(check.sql);
      const orphanCount = parseInt(res.rows[0].count, 10);
      if (orphanCount > 0) {
        throw new Error(`Referential integrity violation on ${check.name}: ${orphanCount} orphan rows found.`);
      }
    }

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
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runSeed().catch(() => process.exit(1));
}

module.exports = { runSeed };
