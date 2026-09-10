require('dotenv').config();
const { Pool } = require('pg');
const baseUrl = process.env.DATABASE_URL.replace('theiakshi_hrms', 'postgres');
const p = new Pool({ connectionString: baseUrl });
p.query("SELECT datname FROM pg_database WHERE datname = 'theiakshi_test'")
  .then(r => { console.log('test_db_exists:', r.rows.length > 0); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
