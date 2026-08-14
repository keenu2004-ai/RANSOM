/**
 * THEIAKSHI ENTERPRISE HRMS — DATABASE MIGRATION RUNNER
 * Executes PostgreSQL schema migrations sequentially.
 */

const fs = require('fs');
const path = require('path');
let Pool;
try {
  Pool = require('pg').Pool;
} catch (e) {
  Pool = require(path.join(__dirname, '../../backend/node_modules/pg')).Pool;
}

// Load environment variables if dotenv is present
try {
  require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });
} catch (e) {
  // Ignore if dotenv is not available at script initialization
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ ERROR: DATABASE_URL environment variable is missing.');
  console.error('Please set DATABASE_URL in your environment or backend/.env file.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false }
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('🔄 Connecting to PostgreSQL database...');
    
    // Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // First ensure base schema is loaded
    const schemaPath = path.join(__dirname, '../schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('📜 Executing baseline schema DDL (schema.sql)...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schemaSql);
      console.log('✅ Baseline schema loaded successfully.');
    }

    // Read migrations directory
    const migrationsDir = path.join(__dirname, '../migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

      for (const file of files) {
        const res = await client.query(
          'SELECT name FROM schema_migrations WHERE name = $1',
          [file]
        );

        if (res.rows.length === 0) {
          console.log(`🚀 Executing migration: ${file}...`);
          const migrationSql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

          await client.query('BEGIN');
          try {
            await client.query(migrationSql);
            await client.query(
              'INSERT INTO schema_migrations (name) VALUES ($1)',
              [file]
            );
            await client.query('COMMIT');
            console.log(`✅ Applied migration: ${file}`);
          } catch (err) {
            await client.query('ROLLBACK');
            console.error(`❌ Migration failed on file ${file}:`, err.message);
            throw err;
          }
        } else {
          console.log(`⏭️ Migration already applied: ${file}`);
        }
      }
    }

    console.log('🎉 All PostgreSQL database migrations executed successfully!');
  } catch (error) {
    console.error('❌ MIGRATION ERROR:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
