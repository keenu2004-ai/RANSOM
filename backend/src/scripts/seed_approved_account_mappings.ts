import { query, withTransaction } from '../db';
import bcrypt from 'bcryptjs';

export interface AccountMapping {
  microsoftAccount: string;
  hrmsName: string;
  desiredRole: string;
  isNew: boolean;
  searchNames: string[];
  searchEmails: string[];
}

export async function runApprovedAccountMappings() {
  console.log('============================================================');
  console.log('EXPLICIT MICROSOFT ENTRA ACCOUNT → THEIAKSHI HRMS MAPPING');
  console.log('============================================================\n');

  try {
    // 1. Fetch Organization ID
    const orgRes = await query(`SELECT id, name FROM organizations LIMIT 1`);
    if (orgRes.rows.length === 0) {
      console.error('❌ No organization found in database!');
      return;
    }
    const orgId = orgRes.rows[0].id;
    console.log(`🏢 Organization Context: ${orgRes.rows[0].name} (${orgId})\n`);

    // 2. Fetch Roles Map
    const rolesRes = await query(`SELECT id, name FROM roles`);
    const roleMap = new Map<string, string>();
    rolesRes.rows.forEach(r => roleMap.set(r.name, r.id));

    console.log('=== PRE-MODIFICATION AUDIT TABLE ===');
    const preUsers = await query(`
      SELECT 
        u.id as user_id, 
        u.email as user_email, 
        u.status as user_status, 
        u.microsoft_oid, 
        COALESCE(r.name, 'EMPLOYEE') as role,
        e.id as employee_id, 
        e.employee_code,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.email as employee_email
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      LEFT JOIN employees e ON e.user_id = u.id
      WHERE u.organization_id = $1
      ORDER BY u.created_at ASC
    `, [orgId]);

    console.table(preUsers.rows.map(row => ({
      'User ID': row.user_id,
      'User Email': row.user_email,
      'Employee Name': row.employee_name || 'N/A',
      'Employee Email': row.employee_email || 'N/A',
      'Role': row.role,
      'MS OID': row.microsoft_oid || 'UNLINKED',
      'Status': row.user_status
    })));

    const mappingsConfig: AccountMapping[] = [
      {
        microsoftAccount: 'office@theiakshi.com',
        hrmsName: 'Sumit Kumar',
        desiredRole: 'HR_MANAGER',
        isNew: false,
        searchNames: ['Sumit Kumar', 'Sumit'],
        searchEmails: ['office@theiakshi.com', 'sumit@theiakshi.com', 'hr@theiakshi.com']
      },
      {
        microsoftAccount: 'Chennai@theiakshi.com',
        hrmsName: 'Prathaph S',
        desiredRole: 'EMPLOYEE',
        isNew: false,
        searchNames: ['Prathaph S', 'Prathaph'],
        searchEmails: ['chennai@theiakshi.com', 'prathaph@theiakshi.com']
      },
      {
        microsoftAccount: 'north@theiakshi.com',
        hrmsName: 'Priyankit Kataria',
        desiredRole: 'EMPLOYEE',
        isNew: false,
        searchNames: ['Priyankit Kataria', 'Priyankit'],
        searchEmails: ['north@theiakshi.com', 'priyankit@theiakshi.com']
      },
      {
        microsoftAccount: 'Vaibhav@theiakshi.com',
        hrmsName: 'Vaibhav Rajput',
        desiredRole: 'EMPLOYEE',
        isNew: false,
        searchNames: ['Vaibhav Rajput', 'Vaibhav'],
        searchEmails: ['vaibhav@theiakshi.com', 'employee@theiakshi.com']
      },
      {
        microsoftAccount: 'info@theiakshi.com',
        hrmsName: 'Info HR Team',
        desiredRole: 'HR_MANAGER',
        isNew: true,
        searchNames: ['Info HR Team', 'Info'],
        searchEmails: ['info@theiakshi.com']
      },
      {
        microsoftAccount: 'admin@theiakshi.onmicrosoft.com',
        hrmsName: 'Vinay Kumar Tanwar',
        desiredRole: 'SUPER_ADMIN',
        isNew: false,
        searchNames: ['Vinay Kumar Tanwar', 'Vinay Tanwar', 'Admin'],
        searchEmails: ['admin@theiakshi.onmicrosoft.com', 'admin@theiakshienterprises.onmicrosoft.com', 'admin@theiakshi.com']
      },
      {
        microsoftAccount: 'Vinay@theiakshi.com',
        hrmsName: 'Vinay Staff',
        desiredRole: 'EMPLOYEE',
        isNew: true,
        searchNames: ['Vinay Staff', 'Vinay Employee'],
        searchEmails: ['vinay@theiakshi.com']
      }
    ];

    console.log('\n============================================================');
    console.log('PROCESSING APPROVED ACCOUNT MAPPINGS...');
    console.log('============================================================\n');

    for (const item of mappingsConfig) {
      console.log(`\n📌 Processing [${item.microsoftAccount}] -> Target: ${item.hrmsName} (${item.desiredRole})`);

      await withTransaction(async (client) => {
        // Search existing user / employee
        const existingQuery = await client.query(`
          SELECT 
            u.id as user_id, 
            u.email as user_email,
            u.microsoft_oid,
            e.id as employee_id,
            e.first_name,
            e.last_name,
            e.email as employee_email,
            r.name as role_name
          FROM users u
          LEFT JOIN user_roles ur ON ur.user_id = u.id
          LEFT JOIN roles r ON r.id = ur.role_id
          LEFT JOIN employees e ON e.user_id = u.id
          WHERE u.organization_id = $1
            AND (
              LOWER(u.email) = ANY($2::text[]) OR 
              LOWER(e.email) = ANY($2::text[]) OR
              LOWER(CONCAT(e.first_name, ' ', e.last_name)) = ANY($3::text[]) OR
              LOWER(e.first_name) = ANY($3::text[])
            )
          LIMIT 1
        `, [
          orgId, 
          item.searchEmails.map(e => e.toLowerCase()), 
          item.searchNames.map(n => n.toLowerCase())
        ]);

        let userId: string;
        let empId: string | null = null;

        if (existingQuery.rows.length > 0) {
          const found = existingQuery.rows[0];
          userId = found.user_id;
          empId = found.employee_id;
          console.log(`   ✅ Matched Existing HRMS User Record: ID=${userId}, Name=${found.first_name} ${found.last_name}, Current Email=${found.user_email}`);

          // Update primary user email if needed to match Microsoft Account email for explicit resolution
          if (found.user_email.toLowerCase() !== item.microsoftAccount.toLowerCase()) {
            await client.query(`UPDATE users SET email = $1 WHERE id = $2`, [item.microsoftAccount.toLowerCase(), userId]);
            if (empId) {
              await client.query(`UPDATE employees SET email = $1 WHERE id = $2`, [item.microsoftAccount.toLowerCase(), empId]);
            }
            console.log(`   --> Updated User & Employee email to canonical: ${item.microsoftAccount.toLowerCase()}`);
          }

          // Verify & Sync Role if needed
          const roleId = roleMap.get(item.desiredRole);
          if (roleId && found.role_name !== item.desiredRole) {
            await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
            await client.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [userId, roleId]);
            console.log(`   --> Updated Role to: ${item.desiredRole}`);
          }
        } else {
          // Create New User & Employee profile
          console.log(`   ✨ Creating New User & Employee Profile for: ${item.hrmsName}`);
          const defaultPassword = await bcrypt.hash('Theiakshi@2026', 10);
          
          const newUserRes = await client.query(`
            INSERT INTO users (organization_id, email, password_hash, status, display_name)
            VALUES ($1, $2, $3, 'ACTIVE', $4)
            RETURNING id
          `, [orgId, item.microsoftAccount.toLowerCase(), defaultPassword, item.hrmsName]);
          userId = newUserRes.rows[0].id;

          const roleId = roleMap.get(item.desiredRole);
          if (roleId) {
            await client.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [userId, roleId]);
          }

          // Generate employee code
          const empCountRes = await client.query(`SELECT COUNT(*)::int as count FROM employees WHERE organization_id = $1`, [orgId]);
          const empCode = `EMP${String(empCountRes.rows[0].count + 1).padStart(3, '0')}`;
          const nameParts = item.hrmsName.split(' ');
          const firstName = nameParts[0] || item.hrmsName;
          const lastName = nameParts.slice(1).join(' ') || 'Staff';

          const newEmpRes = await client.query(`
            INSERT INTO employees (organization_id, user_id, employee_code, first_name, last_name, email, status, department)
            VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', 'General')
            RETURNING id
          `, [orgId, userId, empCode, firstName, lastName, item.microsoftAccount.toLowerCase()]);
          empId = newEmpRes.rows[0].id;

          console.log(`   --> Created User ID: ${userId}, Employee ID: ${empId}, Code: ${empCode}`);
        }
      });
    }

    console.log('\n=== POST-MODIFICATION AUDIT TABLE ===');
    const postUsers = await query(`
      SELECT 
        u.id as user_id, 
        u.email as user_email, 
        u.status as user_status, 
        u.microsoft_oid, 
        COALESCE(r.name, 'EMPLOYEE') as role,
        e.id as employee_id, 
        e.employee_code,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.email as employee_email
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      LEFT JOIN employees e ON e.user_id = u.id
      WHERE u.organization_id = $1
      ORDER BY u.created_at ASC
    `, [orgId]);

    console.table(postUsers.rows.map(row => ({
      'User ID': row.user_id,
      'User Email': row.user_email,
      'Employee Name': row.employee_name || 'N/A',
      'Employee Email': row.employee_email || 'N/A',
      'Role': row.role,
      'MS OID': row.microsoft_oid || 'UNLINKED',
      'Status': row.user_status
    })));

  } catch (err) {
    console.error('❌ Approved account mappings error:', err);
  }
}

if (require.main === module) {
  runApprovedAccountMappings().then(() => process.exit(0));
}
