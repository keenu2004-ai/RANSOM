import { query } from '../db';

export async function runProductionReadOnlyDiagnostic() {
  console.log('============================================================');
  console.log('PRODUCTION READ-ONLY DIAGNOSTIC — MICROSOFT SSO 403');
  console.log('============================================================\n');

  try {
    // 1. Migration 027 Tracking Verification
    const migRes = await query(`
      SELECT id, name, executed_at 
      FROM schema_migrations 
      WHERE name LIKE '%027%' OR name LIKE '%026%' OR name LIKE '%025%'
      ORDER BY id ASC
    `);

    console.log('--- STEP 1: MIGRATION TRACKING TABLE (schema_migrations) ---');
    console.table(migRes.rows);

    // 2. Canonical Users Production Verification
    const canonicalEmails = [
      'sumit.kumar@theiakshi.com',
      'prathaph.s@theiakshi.com',
      'priyankit.kataria@theiakshi.com',
      'vaibhav.rajput@theiakshi.com',
      'info@theiakshi.com',
      'admin@theiakshi.com',
      'vinay@theiakshi.com'
    ];

    const usersRes = await query(`
      SELECT 
        u.id,
        u.email as canonical_email,
        u.microsoft_login_email,
        u.microsoft_oid,
        u.microsoft_tid,
        u.status,
        u.organization_id
      FROM users u
      WHERE LOWER(u.email) = ANY($1::text[])
      ORDER BY u.created_at ASC
    `, [canonicalEmails.map(e => e.toLowerCase())]);

    console.log('\n--- STEP 2: PRODUCTION USERS DATA ---');
    console.table(usersRes.rows);

    // 3. Exact office@theiakshi.com Lookup
    const officeUser = await query(`
      SELECT 
        u.id,
        u.email as canonical_email,
        u.microsoft_login_email,
        u.microsoft_oid,
        u.microsoft_tid,
        u.status,
        u.organization_id
      FROM users u
      WHERE LOWER(u.microsoft_login_email) = LOWER('office@theiakshi.com')
    `);

    console.log('\n--- STEP 3: EXACT office@theiakshi.com LOOKUP ---');
    console.log(`Count of rows matching LOWER(microsoft_login_email) = 'office@theiakshi.com': ${officeUser.rows.length}`);
    console.table(officeUser.rows);

    // 4. Employee + Role Join for Sumit Kumar
    const joinRes = await query(`
      SELECT 
        u.id as user_id,
        u.email as canonical_email,
        u.microsoft_login_email,
        e.id as employee_id,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        u.status as user_status,
        u.organization_id,
        COALESCE(r.name, 'EMPLOYEE') as role_name
      FROM users u
      LEFT JOIN employees e ON e.user_id = u.id
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE LOWER(u.email) = 'sumit.kumar@theiakshi.com' OR LOWER(u.microsoft_login_email) = 'office@theiakshi.com'
    `);

    console.log('\n--- STEP 4: EMPLOYEE & ROLE JOIN FOR SUMIT KUMAR ---');
    console.table(joinRes.rows);

  } catch (err: any) {
    console.error('❌ Read-only diagnostic error:', err.message);
  }
}

if (require.main === module) {
  runProductionReadOnlyDiagnostic().then(() => process.exit(0));
}
