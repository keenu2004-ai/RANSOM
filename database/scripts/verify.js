/**
 * THEIAKSHI ENTERPRISE HRMS — DATABASE VERIFICATION SCRIPT
 * Audits table counts against expected master, identity, and transactional baseline metrics.
 */

const path = require('path');
const { Pool } = require('pg');

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

const BASELINE_EXPECTATIONS = [
  // Required Master Data
  { table: 'organizations', min: 1, type: 'REQUIRED MASTER DATA' },
  { table: 'organization_settings', min: 1, type: 'REQUIRED MASTER DATA' },
  { table: 'branches', min: 1, type: 'REQUIRED MASTER DATA' },
  { table: 'roles', min: 5, type: 'REQUIRED MASTER DATA' },
  { table: 'permissions', min: 35, type: 'REQUIRED MASTER DATA' },
  { table: 'departments', min: 7, type: 'REQUIRED MASTER DATA' },
  { table: 'designations', min: 7, type: 'REQUIRED MASTER DATA' },
  { table: 'teams', min: 7, type: 'REQUIRED MASTER DATA' },
  { table: 'shifts', min: 1, type: 'REQUIRED MASTER DATA' },
  { table: 'attendance_locations', min: 1, type: 'REQUIRED MASTER DATA' },
  { table: 'leave_types', min: 4, type: 'REQUIRED MASTER DATA' },
  { table: 'expense_categories', min: 7, type: 'REQUIRED MASTER DATA' },
  { table: 'projects', min: 4, type: 'REQUIRED MASTER DATA' },
  { table: 'document_types', min: 9, type: 'REQUIRED MASTER DATA' },
  { table: 'holidays', min: 4, type: 'REQUIRED MASTER DATA' },
  { table: 'statutory_rules', min: 1, type: 'REQUIRED MASTER DATA' },

  // Required Identity Data
  { table: 'users', min: 5, type: 'REQUIRED IDENTITY DATA' },
  { table: 'user_roles', min: 5, type: 'REQUIRED IDENTITY DATA' },
  { table: 'role_permissions', min: 15, type: 'REQUIRED IDENTITY DATA' },
  { table: 'employees', min: 3, type: 'REQUIRED IDENTITY DATA' },
  { table: 'leave_balances', min: 12, type: 'REQUIRED IDENTITY DATA' },

  // Expected Empty Transactional Data
  { table: 'attendance', min: 0, type: 'EXPECTED EMPTY — TRANSACTIONAL TABLE' },
  { table: 'leave_requests', min: 0, type: 'EXPECTED EMPTY — TRANSACTIONAL TABLE' },
  { table: 'expenses', min: 0, type: 'EXPECTED EMPTY — TRANSACTIONAL TABLE' },
  { table: 'timesheets', min: 0, type: 'EXPECTED EMPTY — TRANSACTIONAL TABLE' },
  { table: 'salary_structures', min: 0, type: 'EXPECTED EMPTY — TRANSACTIONAL TABLE' },
  { table: 'payroll_records', min: 0, type: 'EXPECTED EMPTY — TRANSACTIONAL TABLE' },
  { table: 'compliance_tasks', min: 0, type: 'EXPECTED EMPTY — TRANSACTIONAL TABLE' },
  { table: 'documents', min: 0, type: 'EXPECTED EMPTY — TRANSACTIONAL TABLE' },
  { table: 'announcements', min: 0, type: 'EXPECTED EMPTY — TRANSACTIONAL TABLE' },
  { table: 'notifications', min: 0, type: 'EXPECTED EMPTY — TRANSACTIONAL TABLE' },
  { table: 'helpdesk_tickets', min: 0, type: 'EXPECTED EMPTY — TRANSACTIONAL TABLE' },
  { table: 'ticket_comments', min: 0, type: 'EXPECTED EMPTY — TRANSACTIONAL TABLE' },
  { table: 'audit_logs', min: 0, type: 'EXPECTED EMPTY — TRANSACTIONAL TABLE' }
];

async function verifyDatabase() {
  const client = await pool.connect();
  let hasFailure = false;

  try {
    console.log('===================================================================================');
    console.log('  THEIAKSHI ENTERPRISE HRMS — DATABASE BASELINE VERIFICATION MATRIX');
    console.log('===================================================================================');
    console.log(
      'TABLE'.padEnd(25) + ' | ' +
      'CLASSIFICATION'.padEnd(38) + ' | ' +
      'MIN'.padEnd(5) + ' | ' +
      'ACTUAL'.padEnd(7) + ' | STATUS'
    );
    console.log('-----------------------------------------------------------------------------------');

    for (const item of BASELINE_EXPECTATIONS) {
      const res = await client.query(`SELECT COUNT(*)::int as count FROM ${item.table}`);
      const count = res.rows[0].count;
      let status = 'PASS';

      if (item.type !== 'EXPECTED EMPTY — TRANSACTIONAL TABLE') {
        if (count < item.min) {
          status = 'FAIL';
          hasFailure = true;
        }
      }

      console.log(
        item.table.padEnd(25) + ' | ' +
        item.type.padEnd(38) + ' | ' +
        String(item.min).padEnd(5) + ' | ' +
        String(count).padEnd(7) + ' | ' +
        (status === 'PASS' ? '✅ PASS' : '❌ FAIL')
      );
    }

    console.log('-----------------------------------------------------------------------------------');

    if (hasFailure) {
      console.error('❌ VERIFICATION FAILED: One or more baseline tables do not meet minimum counts.');
      process.exit(1);
    } else {
      console.log('✅ VERIFICATION PASSED: All baseline master, identity, and transactional metrics confirmed.');
    }
  } catch (error) {
    console.error('❌ VERIFICATION SCRIPT ERROR:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  verifyDatabase();
}

module.exports = { verifyDatabase };
