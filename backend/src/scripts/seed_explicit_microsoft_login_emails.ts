import { query, withTransaction } from '../db';

export async function seedExplicitMicrosoftLoginEmails() {
  console.log('============================================================');
  console.log('SEEDING EXPLICIT MICROSOFT LOGIN EMAILS (CANONICAL EMAILS UNCHANGED)');
  console.log('============================================================\n');

  try {
    const mappings = [
      { searchName: 'Sumit Kumar', microsoftLoginEmail: 'office@theiakshi.com', desiredRole: 'HR_MANAGER' },
      { searchName: 'Prathaph S', microsoftLoginEmail: 'Chennai@theiakshi.com', desiredRole: 'EMPLOYEE' },
      { searchName: 'Priyankit Kataria', microsoftLoginEmail: 'north@theiakshi.com', desiredRole: 'EMPLOYEE' },
      { searchName: 'Vaibhav Rajput', microsoftLoginEmail: 'Vaibhav@theiakshi.com', desiredRole: 'EMPLOYEE' },
      { searchName: 'Info HR Team', microsoftLoginEmail: 'info@theiakshi.com', desiredRole: 'HR_MANAGER' },
      { searchName: 'Vinay Kumar Tanwar', microsoftLoginEmail: 'admin@theiakshi.onmicrosoft.com', desiredRole: 'SUPER_ADMIN' },
      { searchName: 'Vinay Staff', microsoftLoginEmail: 'Vinay@theiakshi.com', desiredRole: 'EMPLOYEE' }
    ];

    await withTransaction(async (client) => {
      // Ensure column exists
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS microsoft_login_email VARCHAR(255)`);

      for (const item of mappings) {
        // Search user by employee name or email
        const userRes = await client.query(`
          SELECT u.id, u.email, u.microsoft_login_email, CONCAT(e.first_name, ' ', e.last_name) as employee_name
          FROM users u
          JOIN employees e ON e.user_id = u.id
          WHERE LOWER(CONCAT(e.first_name, ' ', e.last_name)) = LOWER($1)
             OR LOWER(e.first_name) = LOWER($1)
             OR LOWER(u.email) = LOWER($2)
          LIMIT 1
        `, [item.searchName, item.microsoftLoginEmail]);

        if (userRes.rows.length > 0) {
          const u = userRes.rows[0];
          await client.query(`UPDATE users SET microsoft_login_email = $1 WHERE id = $2`, [item.microsoftLoginEmail.toLowerCase(), u.id]);
          console.log(`✅ Set microsoft_login_email = "${item.microsoftLoginEmail.toLowerCase()}" for User ID: ${u.id} (${u.employee_name}, Canonical Email: "${u.email}")`);
        } else {
          console.log(`⚠️ User record for ${item.searchName} not found. Skipping.`);
        }
      }
    });

  } catch (err) {
    console.error('❌ Error seeding explicit Microsoft login emails:', err);
  }
}

if (require.main === module) {
  seedExplicitMicrosoftLoginEmails().then(() => process.exit(0));
}
