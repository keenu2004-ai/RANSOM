/**
 * THEIAKSHI ENTERPRISE HRMS — DATABASE INTEGRITY CHECK SCRIPT
 * Audits relational foreign keys, orphan references, and tenancy isolation across all entities.
 */

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

const INTEGRITY_CHECKS = [
  {
    name: 'Orphan User Roles',
    query: `
      SELECT COUNT(*)::int as count FROM user_roles ur
      LEFT JOIN users u ON ur.user_id = u.id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.id IS NULL OR r.id IS NULL
    `
  },
  {
    name: 'Orphan Role Permissions',
    query: `
      SELECT COUNT(*)::int as count FROM role_permissions rp
      LEFT JOIN roles r ON rp.role_id = r.id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      WHERE r.id IS NULL OR p.id IS NULL
    `
  },
  {
    name: 'Orphan Employee User References',
    query: `
      SELECT COUNT(*)::int as count FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.user_id IS NOT NULL AND u.id IS NULL
    `
  },
  {
    name: 'Orphan Employee Department References',
    query: `
      SELECT COUNT(*)::int as count FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE e.department_id IS NOT NULL AND d.id IS NULL
    `
  },
  {
    name: 'Orphan Employee Designation References',
    query: `
      SELECT COUNT(*)::int as count FROM employees e
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE e.designation_id IS NOT NULL AND des.id IS NULL
    `
  },
  {
    name: 'Orphan Leave Balances Employee References',
    query: `
      SELECT COUNT(*)::int as count FROM leave_balances lb
      LEFT JOIN employees e ON lb.employee_id = e.id
      WHERE e.id IS NULL
    `
  },
  {
    name: 'Orphan Leave Balances Type References',
    query: `
      SELECT COUNT(*)::int as count FROM leave_balances lb
      LEFT JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lt.id IS NULL
    `
  },
  {
    name: 'Invalid Organization Tenancy Isolation',
    query: `
      SELECT COUNT(*)::int as count FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      WHERE o.id IS NULL
    `
  }
];

async function checkIntegrity() {
  const client = await pool.connect();
  let hasErrors = false;

  try {
    console.log('===================================================================');
    console.log('  THEIAKSHI ENTERPRISE HRMS — DATABASE INTEGRITY CHECK AUDIT');
    console.log('===================================================================');

    for (const check of INTEGRITY_CHECKS) {
      const res = await client.query(check.query);
      const orphanCount = res.rows[0].count;
      const status = orphanCount === 0 ? '✅ PASS' : '❌ FAIL';

      if (orphanCount > 0) {
        hasErrors = true;
      }

      console.log(
        check.name.padEnd(45) + ' | Orphans: ' +
        String(orphanCount).padEnd(5) + ' | ' + status
      );
    }

    console.log('-------------------------------------------------------------------');

    if (hasErrors) {
      console.error('❌ INTEGRITY CHECK FAILED: Database contains orphan references or invalid tenancy scoping.');
      process.exit(1);
    } else {
      console.log('✅ INTEGRITY CHECK PASSED: Zero orphan records found. Relational structure is intact.');
    }
  } catch (error) {
    console.error('❌ INTEGRITY CHECK SCRIPT ERROR:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  checkIntegrity();
}

module.exports = { checkIntegrity };
