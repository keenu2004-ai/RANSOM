import { query } from '../db';

export interface DryRunRow {
  microsoftAccount: string;
  oid: string;
  hrmsUserId: string;
  employeeId: string;
  employeeName: string;
  currentEmail: string;
  currentRole: string;
  desiredRole: string;
  organizationId: string;
  action: string;
}

export async function runDryRunMappingInspection() {
  console.log('============================================================');
  console.log('DRY RUN — PRODUCTION DATABASE MAPPING SAFETY CHECK');
  console.log('============================================================\n');

  try {
    const orgRes = await query(`SELECT id, name FROM organizations LIMIT 1`);
    const orgId = orgRes.rows.length > 0 ? orgRes.rows[0].id : '00000000-0000-0000-0000-000000000001';
    const orgName = orgRes.rows.length > 0 ? orgRes.rows[0].name : 'Theiakshi Enterprises';

    const mappings = [
      {
        microsoftAccount: 'office@theiakshi.com',
        expectedName: 'Sumit Kumar',
        desiredRole: 'HR_MANAGER',
        searchEmails: ['office@theiakshi.com', 'sumit@theiakshi.com', 'hr@theiakshi.com'],
        searchNames: ['Sumit Kumar', 'Sumit']
      },
      {
        microsoftAccount: 'Chennai@theiakshi.com',
        expectedName: 'Prathaph S',
        desiredRole: 'EMPLOYEE',
        searchEmails: ['chennai@theiakshi.com', 'prathaph@theiakshi.com'],
        searchNames: ['Prathaph S', 'Prathaph']
      },
      {
        microsoftAccount: 'north@theiakshi.com',
        expectedName: 'Priyankit Kataria',
        desiredRole: 'EMPLOYEE',
        searchEmails: ['north@theiakshi.com', 'priyankit@theiakshi.com'],
        searchNames: ['Priyankit Kataria', 'Priyankit']
      },
      {
        microsoftAccount: 'Vaibhav@theiakshi.com',
        expectedName: 'Vaibhav Rajput',
        desiredRole: 'EMPLOYEE',
        searchEmails: ['vaibhav@theiakshi.com', 'employee@theiakshi.com'],
        searchNames: ['Vaibhav Rajput', 'Vaibhav']
      },
      {
        microsoftAccount: 'info@theiakshi.com',
        expectedName: 'Info HR Team',
        desiredRole: 'HR_MANAGER',
        searchEmails: ['info@theiakshi.com'],
        searchNames: ['Info HR Team', 'Info']
      },
      {
        microsoftAccount: 'admin@theiakshi.onmicrosoft.com',
        expectedName: 'Vinay Kumar Tanwar',
        desiredRole: 'SUPER_ADMIN',
        searchEmails: ['admin@theiakshi.onmicrosoft.com', 'admin@theiakshienterprises.onmicrosoft.com', 'admin@theiakshi.com'],
        searchNames: ['Vinay Kumar Tanwar', 'Vinay Tanwar', 'Admin']
      },
      {
        microsoftAccount: 'admin@theiakshienterprises.onmicrosoft.com',
        expectedName: 'Vinay Kumar Tanwar',
        desiredRole: 'SUPER_ADMIN',
        searchEmails: ['admin@theiakshienterprises.onmicrosoft.com', 'admin@theiakshi.onmicrosoft.com'],
        searchNames: ['Vinay Kumar Tanwar', 'Vinay Tanwar']
      },
      {
        microsoftAccount: 'Vinay@theiakshi.com',
        expectedName: 'Vinay Staff',
        desiredRole: 'EMPLOYEE',
        searchEmails: ['vinay@theiakshi.com'],
        searchNames: ['Vinay Staff', 'Vinay Employee']
      }
    ];

    const auditRows: DryRunRow[] = [];
    let linkedCount = 0;
    let createCount = 0;
    let conflictCount = 0;
    let unchangedCount = 0;

    for (const item of mappings) {
      const matchRes = await query(`
        SELECT 
          u.id as user_id,
          u.email as user_email,
          u.microsoft_oid,
          e.id as employee_id,
          CONCAT(e.first_name, ' ', e.last_name) as employee_name,
          r.name as role_name
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        LEFT JOIN employees e ON e.user_id = u.id
        WHERE u.organization_id = $1
          AND (
            LOWER(u.email) = ANY($2::text[]) OR
            LOWER(e.email) = ANY($2::text[]) OR
            LOWER(CONCAT(e.first_name, ' ', e.last_name)) = ANY($3::text[])
          )
        LIMIT 1
      `, [
        orgId,
        item.searchEmails.map(e => e.toLowerCase()),
        item.searchNames.map(n => n.toLowerCase())
      ]);

      if (matchRes.rows.length > 0) {
        const row = matchRes.rows[0];
        const currentRole = row.role_name || 'EMPLOYEE';
        let action = 'LINK EXISTING USER';

        if (currentRole !== item.desiredRole) {
          action = `ROLE MISMATCH (Current: ${currentRole}, Desired: ${item.desiredRole})`;
          conflictCount++;
        } else {
          linkedCount++;
        }

        auditRows.push({
          microsoftAccount: item.microsoftAccount,
          oid: row.microsoft_oid || 'UNLINKED (Pending First SSO Login)',
          hrmsUserId: row.user_id,
          employeeId: row.employee_id || 'N/A',
          employeeName: row.employee_name || item.expectedName,
          currentEmail: row.user_email,
          currentRole: currentRole,
          desiredRole: item.desiredRole,
          organizationId: orgId,
          action: action
        });
      } else {
        createCount++;
        auditRows.push({
          microsoftAccount: item.microsoftAccount,
          oid: 'UNLINKED (New User)',
          hrmsUserId: 'WILL_CREATE_NEW',
          employeeId: 'WILL_CREATE_NEW',
          employeeName: item.expectedName,
          currentEmail: item.microsoftAccount,
          currentRole: 'NONE',
          desiredRole: item.desiredRole,
          organizationId: orgId,
          action: 'CREATE NEW USER + EMPLOYEE'
        });
      }
    }

    console.log('=== DRY-RUN AUDIT REPORT ===\n');
    console.table(auditRows);

    console.log('\n============================================================');
    console.log(`TOTAL EXISTING USERS TO LINK: ${linkedCount}`);
    console.log(`TOTAL NEW USERS TO CREATE: ${createCount}`);
    console.log(`TOTAL CONFLICTS: ${conflictCount}`);
    console.log(`TOTAL UNCHANGED: ${unchangedCount}`);
    console.log('============================================================\n');

  } catch (err) {
    console.error('Dry run error:', err);
  }
}

if (require.main === module) {
  runDryRunMappingInspection().then(() => process.exit(0));
}
