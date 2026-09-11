const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const p = new Pool({ connectionString: process.env.DATABASE_URL });

async function reset() {
  try {
    const hash = await bcrypt.hash('password123', 10);
    await p.query('UPDATE users SET password_hash = $1, auth_version = auth_version + 1 WHERE email = $2', [hash, 'superadmin@theiakshi.com']);
    console.log('Password reset successfully to password123');
  } catch (err) {
    console.error('Failed:', err);
  } finally {
    await p.end();
  }
}
reset();
