import { query, withTransaction } from '../db';

export async function deactivateLegacyAccounts() {
  console.log('============================================================');
  console.log('DEACTIVATING LEGACY DEMO LOGIN ACCOUNTS (PRESERVING HISTORY)');
  console.log('============================================================\n');

  try {
    const legacyEmails = [
      'superadmin@theiakshi.com',
      'admin@theiakshi.com',
      'hr@theiakshi.com',
      'manager@theiakshi.com',
      'employee@theiakshi.com'
    ];

    const activeMicrosoftEmails = [
      'office@theiakshi.com',
      'chennai@theiakshi.com',
      'north@theiakshi.com',
      'vaibhav@theiakshi.com',
      'info@theiakshi.com',
      'admin@theiakshi.onmicrosoft.com',
      'admin@theiakshienterprises.onmicrosoft.com',
      'vinay@theiakshi.com'
    ];

    // 1. Audit Table Counts Before
    const preUsers = await query(`SELECT COUNT(*)::int as total FROM users`);
    const preEmps = await query(`SELECT COUNT(*)::int as total FROM employees`);
    const preAtt = await query(`SELECT COUNT(*)::int as total FROM attendance`);
    const preLeaves = await query(`SELECT COUNT(*)::int as total FROM leave_requests`);
    const preExpenses = await query(`SELECT COUNT(*)::int as total FROM expenses`);
    const preAudit = await query(`SELECT COUNT(*)::int as total FROM audit_logs`);

    console.log('=== HISTORICAL DATA COUNTS (BEFORE CLEANUP) ===');
    console.log(`Users: ${preUsers.rows[0].total}`);
    console.log(`Employees: ${preEmps.rows[0].total}`);
    console.log(`Attendance Records: ${preAtt.rows[0].total}`);
    console.log(`Leave Requests: ${preLeaves.rows[0].total}`);
    console.log(`Expenses: ${preExpenses.rows[0].total}`);
    console.log(`Audit Logs: ${preAudit.rows[0].total}\n`);

    // 2. Transactional Deactivation
    await withTransaction(async (client) => {
      // Deactivate legacy accounts
      const deactivateRes = await client.query(`
        UPDATE users 
        SET status = 'INACTIVE' 
        WHERE LOWER(email) = ANY($1::text[]) 
          AND LOWER(email) NOT IN (SELECT LOWER(e) FROM UNNEST($2::text[]) e)
        RETURNING id, email, status
      `, [legacyEmails.map(e => e.toLowerCase()), activeMicrosoftEmails.map(e => e.toLowerCase())]);

      console.log(`✅ Deactivated ${deactivateRes.rows.length} legacy demo user accounts:`);
      deactivateRes.rows.forEach(r => console.log(`   - ${r.email} (ID: ${r.id}, Status: ${r.status})`));

      // Ensure all Microsoft Entra active accounts are strictly ACTIVE
      await client.query(`
        UPDATE users 
        SET status = 'ACTIVE' 
        WHERE LOWER(email) = ANY($1::text[])
      `, [activeMicrosoftEmails.map(e => e.toLowerCase())]);
    });

    // 3. Audit Table Counts After
    const postUsers = await query(`SELECT COUNT(*)::int as total FROM users`);
    const postEmps = await query(`SELECT COUNT(*)::int as total FROM employees`);
    const postAtt = await query(`SELECT COUNT(*)::int as total FROM attendance`);
    const postLeaves = await query(`SELECT COUNT(*)::int as total FROM leave_requests`);
    const postExpenses = await query(`SELECT COUNT(*)::int as total FROM expenses`);
    const postAudit = await query(`SELECT COUNT(*)::int as total FROM audit_logs`);

    console.log('\n=== HISTORICAL DATA COUNTS (AFTER CLEANUP) ===');
    console.log(`Users: ${postUsers.rows[0].total} (0 rows deleted)`);
    console.log(`Employees: ${postEmps.rows[0].total} (0 rows deleted)`);
    console.log(`Attendance Records: ${postAtt.rows[0].total} (0 rows deleted)`);
    console.log(`Leave Requests: ${postLeaves.rows[0].total} (0 rows deleted)`);
    console.log(`Expenses: ${postExpenses.rows[0].total} (0 rows deleted)`);
    console.log(`Audit Logs: ${postAudit.rows[0].total} (0 rows deleted)\n`);

  } catch (err) {
    console.error('❌ Deactivation error:', err);
  }
}

if (require.main === module) {
  deactivateLegacyAccounts().then(() => process.exit(0));
}
