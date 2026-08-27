import { query } from '../db';

export async function runDiagnosticAuthCheck() {
  console.log('========================================');
  console.log('MICROSOFT SSO BACKEND DIAGNOSTIC REPORT');
  console.log('========================================\n');

  try {
    // 1. Database Connection & System Context
    const dbInfo = await query(`SELECT current_database() as db_name, current_user as db_user, inet_server_addr() as db_host`);
    const orgRes = await query(`SELECT id, name FROM organizations LIMIT 1`);
    const userCount = await query(`SELECT COUNT(*)::int as count FROM users`);
    const empCount = await query(`SELECT COUNT(*)::int as count FROM employees`);

    console.log('--- PRODUCTION DATABASE DIAGNOSTIC ---');
    console.log(`Database Name : ${dbInfo.rows[0]?.db_name || 'N/A'}`);
    console.log(`Database User : ${dbInfo.rows[0]?.db_user || 'N/A'}`);
    console.log(`Database Host : ${dbInfo.rows[0]?.db_host || 'localhost'}`);
    console.log(`Organization  : ${orgRes.rows[0]?.name} (ID: ${orgRes.rows[0]?.id})`);
    console.log(`Total Users   : ${userCount.rows[0]?.count}`);
    console.log(`Total Employees: ${empCount.rows[0]?.count}\n`);

    // 2. Full Users & Employees Alignment Inspection
    console.log('--- USERS & LINKED EMPLOYEES INSPECTION ---');
    const usersList = await query(`
      SELECT 
        u.id as user_id, 
        u.email as user_email, 
        u.microsoft_oid, 
        u.microsoft_tid, 
        u.status as user_status, 
        COALESCE(r.name, 'EMPLOYEE') as role_name,
        e.id as employee_id, 
        e.employee_code,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.email as employee_email
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      LEFT JOIN employees e ON e.user_id = u.id
      ORDER BY u.created_at ASC
    `);

    console.table(usersList.rows.map(r => ({
      'User ID': r.user_id,
      'User Email': r.user_email,
      'Employee ID': r.employee_id || 'N/A',
      'Employee Name': r.employee_name || 'N/A',
      'Employee Email': r.employee_email || 'N/A',
      'Role': r.role_name,
      'MS OID': r.microsoft_oid || 'UNLINKED',
      'Status': r.user_status
    })));

    // 3. Specific Approved Accounts Check
    const targetMappings = [
      { microsoftAccount: 'office@theiakshi.com', expectedEmployee: 'Sumit Kumar', expectedRole: 'HR_MANAGER' },
      { microsoftAccount: 'Chennai@theiakshi.com', expectedEmployee: 'Prathaph S', expectedRole: 'EMPLOYEE' },
      { microsoftAccount: 'north@theiakshi.com', expectedEmployee: 'Priyankit Kataria', expectedRole: 'EMPLOYEE' },
      { microsoftAccount: 'Vaibhav@theiakshi.com', expectedEmployee: 'Vaibhav Rajput', expectedRole: 'EMPLOYEE' },
      { microsoftAccount: 'info@theiakshi.com', expectedEmployee: 'Info HR Team', expectedRole: 'HR_MANAGER' },
      { microsoftAccount: 'admin@theiakshi.onmicrosoft.com', expectedEmployee: 'Vinay Kumar Tanwar', expectedRole: 'SUPER_ADMIN' },
      { microsoftAccount: 'Vinay@theiakshi.com', expectedEmployee: 'Vinay Staff', expectedRole: 'EMPLOYEE' }
    ];

    console.log('\n--- APPROVED ACCOUNTS RESOLUTION ANALYSIS ---');
    for (const item of targetMappings) {
      // Find matching user by exact email or candidate matching
      const userMatch = usersList.rows.find(u => 
        u.user_email.toLowerCase() === item.microsoftAccount.toLowerCase() ||
        (u.employee_email && u.employee_email.toLowerCase() === item.microsoftAccount.toLowerCase()) ||
        (u.employee_name && u.employee_name.toLowerCase().includes(item.expectedEmployee.toLowerCase().split(' ')[0]))
      );

      if (userMatch) {
        const isEmailExact = userMatch.user_email.toLowerCase() === item.microsoftAccount.toLowerCase();
        console.log(`\n📌 Microsoft: [${item.microsoftAccount}]`);
        console.log(`   Target Employee : ${item.expectedEmployee}`);
        console.log(`   Found HRMS User : ${userMatch.employee_name} (User ID: ${userMatch.user_id})`);
        console.log(`   Current User Email : ${userMatch.user_email}`);
        console.log(`   Current Role    : ${userMatch.role_name}`);
        console.log(`   Exact Email Match : ${isEmailExact ? 'YES' : 'NO (User email is "' + userMatch.user_email + '", while Microsoft candidate is "' + item.microsoftAccount + '")'}`);
        console.log(`   OID Link Status : ${userMatch.microsoft_oid ? 'LINKED (' + userMatch.microsoft_oid + ')' : 'UNLINKED'}`);
      } else {
        console.log(`\n❌ Microsoft: [${item.microsoftAccount}] -> NO MATCHING HRMS RECORD FOUND IN DATABASE!`);
      }
    }

  } catch (err) {
    console.error('Diagnostic check error:', err);
  }
}

if (require.main === module) {
  runDiagnosticAuthCheck().then(() => process.exit(0));
}
