/**
 * THEIAKSHI ENTERPRISE HRMS — DATABASE MIGRATION RUNNER
 * Executes PostgreSQL schema migrations sequentially & safely.
 */

const fs = require('fs');
const path = require('path');
const { splitSqlStatements, hasExecutableSql } = require('./validate_sql');

let Pool;
try {
  Pool = require('pg').Pool;
} catch (e) {
  Pool = require(path.join(__dirname, '../../backend/node_modules/pg')).Pool;
}

try {
  require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });
} catch (e) {}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ ERROR: DATABASE_URL environment variable is missing.');
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
    
    // Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 1. Execute Baseline Schema DDL Statement by Statement
    const schemaPath = path.resolve(__dirname, '../schema.sql');
    console.log(`[DB] Schema path: ${schemaPath}`);

    if (fs.existsSync(schemaPath)) {
      console.log('📜 Executing baseline schema DDL (schema.sql)...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      const statements = splitSqlStatements(schemaSql);

      for (let idx = 0; idx < statements.length; idx++) {
        const stmt = statements[idx];
        if (!hasExecutableSql(stmt.sql)) continue;

        try {
          await client.query(stmt.sql);
        } catch (err) {
          console.error('\n❌ FAILED SCHEMA STATEMENT:');
          console.error(`Statement #${idx + 1} (Lines ${stmt.startLine}-${stmt.endLine})`);
          console.error(`Preview: ${stmt.sql.slice(0, 200)}`);
          console.error(`PostgreSQL Error: ${err.message}\n`);
          throw err;
        }
      }
      console.log('✅ Baseline schema loaded successfully.');
    }

    // 2. Read Migrations Directory & Execute Pending Migrations
    const migrationsDir = path.resolve(__dirname, '../migrations');
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
          const migrationStmts = splitSqlStatements(migrationSql);

          await client.query('BEGIN');
          try {
            for (const mStmt of migrationStmts) {
              if (!hasExecutableSql(mStmt.sql)) continue;
              await client.query(mStmt.sql);
            }
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
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations().catch(() => process.exit(1));
}

module.exports = { runMigrations };
