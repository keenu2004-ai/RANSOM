import { query, withTransaction } from '../db';

export async function seedExplicitMicrosoftLoginEmails() {
  console.log('============================================================');
  console.log('PRODUCTION SEED — EXPLICIT MICROSOFT LOGIN EMAILS');
  console.log('============================================================\n');

  const approvedMappings = [
    { targetUserId: 'usr-001', upn: 'office@theiakshi.com', expectedName: 'Sumit Kumar', expectedRole: 'HR_MANAGER' },
    { targetUserId: 'usr-002', upn: 'chennai@theiakshi.com', expectedName: 'Prathaph S', expectedRole: 'EMPLOYEE' },
    { targetUserId: 'usr-003', upn: 'north@theiakshi.com', expectedName: 'Priyankit Kataria', expectedRole: 'EMPLOYEE' },
    { targetUserId: 'usr-004', upn: 'vaibhav@theiakshi.com', expectedName: 'Vaibhav Rajput', expectedRole: 'EMPLOYEE' },
    { targetUserId: 'usr-info-01', upn: 'info@theiakshi.com', expectedName: 'Info HR Team', expectedRole: 'HR_MANAGER' },
    { targetUserId: 'usr-admin-01', upn: 'admin@theiakshi.onmicrosoft.com', expectedName: 'Vinay Kumar Tanwar', expectedRole: 'SUPER_ADMIN' },
    { targetUserId: 'usr-vinay-02', upn: 'vinay@theiakshi.com', expectedName: 'Vinay Staff', expectedRole: 'EMPLOYEE' }
  ];

  try {
    // 1. Ensure Schema Column Exists (Migration 026)
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS microsoft_login_email VARCHAR(255)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_users_microsoft_login_email_lower ON users (LOWER(microsoft_login_email)) WHERE microsoft_login_email IS NOT NULL`);
    console.log('[SCHEMA] Migration 026 (users.microsoft_login_email) verified / applied.\n');

    // 2. Pre-Execution Dry-Run Validation & Table
    console.log('=== DRY-RUN PRE-MUTATION VALIDATION ===');
    const preRes = await query(`
      SELECT 
        u.id as user_id,
        u.email as canonical_email,
        u.microsoft_login_email as current_login_email,
        u.microsoft_oid,
        u.organization_id,
        COALESCE(r.name, 'EMPLOYEE') as role_name,
        e.id as employee_id,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      LEFT JOIN employees e ON e.user_id = u.id
      ORDER BY u.created_at ASC
    `);

    const dryRunTable: any[] = [];
    let validationPassed = true;

    for (const item of approvedMappings) {
      const u = preRes.rows.find(r => r.user_id === item.targetUserId || (r.employee_name && r.employee_name.toLowerCase().includes(item.expectedName.toLowerCase().split(' ')[0])));
      
      if (!u) {
        console.error(`❌ Validation Failed: Target user for ${item.expectedName} (ID: ${item.targetUserId}) not found in database.`);
        validationPassed = false;
        continue;
      }

      // Conflict Check: Check if this UPN is owned by a DIFFERENT user ID
      const existingOwner = preRes.rows.find(r => r.current_login_email && r.current_login_email.toLowerCase() === item.upn.toLowerCase() && r.user_id !== u.user_id);
      if (existingOwner) {
        console.error(`❌ Conflict Detected: Microsoft UPN ${item.upn} is already assigned to different User ID ${existingOwner.user_id}`);
        validationPassed = false;
        continue;
      }

      const proposedValue = item.upn.toLowerCase();
      const action = (u.current_login_email && u.current_login_email.toLowerCase() === proposedValue)
        ? 'NO_CHANGE (Already Populated)'
        : 'UPDATE (Set microsoft_login_email)';

      dryRunTable.push({
        'Microsoft Login UPN': item.upn,
        'User ID': u.user_id,
        'Canonical Email': u.canonical_email,
        'Employee Name': u.employee_name,
        'Role': u.role_name,
        'Current Value': u.current_login_email || 'NULL',
        'Proposed Value': proposedValue,
        'Action': action
      });
    }

    console.table(dryRunTable);

    if (!validationPassed) {
      throw new Error('Pre-execution dry-run validation failed. Aborting database mutation.');
    }

    // 3. Perform Idempotent Transactional Update
    console.log('\n🚀 Executing Idempotent Transactional Update...');
    await withTransaction(async (client) => {
      for (const item of approvedMappings) {
        const targetUpn = item.upn.toLowerCase();
        
        // Find user by explicit targetUserId or employee name fallback
        const findRes = await client.query(`
          SELECT u.id 
          FROM users u
          LEFT JOIN employees e ON e.user_id = u.id
          WHERE u.id = $1 OR LOWER(CONCAT(e.first_name, ' ', e.last_name)) = LOWER($2)
          LIMIT 1
        `, [item.targetUserId, item.expectedName]);

        if (findRes.rows.length > 0) {
          const userId = findRes.rows[0].id;
          await client.query(`
            UPDATE users 
            SET microsoft_login_email = $1, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $2 AND (microsoft_login_email IS NULL OR LOWER(microsoft_login_email) != $1)
          `, [targetUpn, userId]);
        }
      }
    });

    console.log('✅ Transaction committed successfully.\n');

    // 4. Post-Execution Audit Verification
    console.log('=== POST-EXECUTION VERIFICATION TABLE ===');
    const postRes = await query(`
      SELECT 
        u.id as user_id,
        u.email as canonical_email,
        u.microsoft_login_email,
        u.microsoft_oid,
        u.organization_id,
        u.status as user_status,
        COALESCE(r.name, 'EMPLOYEE') as role_name,
        e.id as employee_id,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      LEFT JOIN employees e ON e.user_id = u.id
      ORDER BY u.created_at ASC
    `);

    const postTable: any[] = [];
    for (const item of approvedMappings) {
      const u = postRes.rows.find(r => r.user_id === item.targetUserId || (r.employee_name && r.employee_name.toLowerCase().includes(item.expectedName.toLowerCase().split(' ')[0])));
      if (u) {
        postTable.push({
          'Microsoft Login Email': item.upn.toLowerCase(),
          'HRMS User ID': u.user_id,
          'Canonical Email': u.canonical_email,
          'Employee Name': u.employee_name,
          'Organization ID': u.organization_id,
          'Role': u.role_name,
          'microsoft_login_email': u.microsoft_login_email,
          'microsoft_oid': u.microsoft_oid || 'UNLINKED (Pending First SSO Login)',
          'Status': u.user_status
        });
      }
    }

    console.table(postTable);

  } catch (err: any) {
    console.error('❌ Database execution error:', err.message);
    throw err;
  }
}

if (require.main === module) {
  seedExplicitMicrosoftLoginEmails().then(() => process.exit(0)).catch(() => process.exit(1));
}
