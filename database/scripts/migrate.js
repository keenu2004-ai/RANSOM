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
  process.stderr.write('❌ ERROR: DATABASE_URL environment variable is missing.\n');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false }
});

function logSync(msg) {
  process.stdout.write(msg + '\n');
}

function errorSync(msg) {
  process.stderr.write(msg + '\n');
}

async function runMigrations() {
  const startTime = Date.now();
  logSync('🔄 Connecting to PostgreSQL database...');

  const client = await pool.connect();
  try {
    const connTest = await client.query('SELECT 1 as conn_test');
    logSync(`[DB] PostgreSQL connection test passed (SELECT 1 = ${connTest.rows[0].conn_test})`);
    
    // Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Inspect existing applied migrations
    const appliedRes = await client.query('SELECT name FROM schema_migrations ORDER BY id ASC');
    const appliedSet = new Set(appliedRes.rows.map(r => r.name));
    
    // Inspect core application tables existence in public schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('organizations', 'users', 'employees', 'attendance')
    `);
    const coreTablesCount = tablesRes.rows.length;

    logSync(`[DB] Migration status check: ${appliedSet.size} applied migration(s), ${coreTablesCount} core table(s) present.`);

    // Baseline schema.sql should ONLY run on a completely fresh, uninitialized database
    const shouldRunBaselineSchema = (appliedSet.size === 0 && coreTablesCount === 0);

    const schemaPath = path.resolve(__dirname, '../schema.sql');

    if (shouldRunBaselineSchema) {
      if (fs.existsSync(schemaPath)) {
        const schemaStartTime = Date.now();
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        logSync('📜 Fresh database detected: Executing baseline schema DDL (schema.sql)...');
        const statements = splitSqlStatements(schemaSql);
        logSync(`[DB] Parsed ${statements.length} baseline schema statement(s).`);

        for (let idx = 0; idx < statements.length; idx++) {
          const stmt = statements[idx];
          if (!hasExecutableSql(stmt.sql)) continue;

          try {
            await client.query(stmt.sql);
          } catch (err) {
            errorSync('\n❌ FAILED SCHEMA STATEMENT:');
            errorSync(`Statement #${idx + 1} (Lines ${stmt.startLine}-${stmt.endLine})`);
            errorSync(`Preview: ${stmt.sql.slice(0, 200)}`);
            errorSync(`PostgreSQL Error: ${err.message}`);
            errorSync(`Error Code: ${err.code || 'N/A'}`);
            throw err;
          }
        }
        logSync(`✅ Baseline schema loaded successfully in ${Date.now() - schemaStartTime} ms.`);
      }
    } else {
      logSync(`⏭️ Skipping baseline schema DDL (schema.sql) — database already initialized.`);
    }

    // 2. Read Migrations Directory & Execute Pending Migrations
    const migrationsDir = path.resolve(__dirname, '../migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

      const appliedList = files.filter(f => appliedSet.has(f));
      const pendingList = files.filter(f => !appliedSet.has(f));

      logSync(`[DB] Applied migrations (${appliedList.length}): ${appliedList.join(', ') || 'None'}`);
      logSync(`[DB] Pending migrations (${pendingList.length}): ${pendingList.join(', ') || 'None'}`);

      for (const file of pendingList) {
        const mStartTime = Date.now();
        logSync(`🚀 Executing migration: ${file}...`);
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
          logSync(`✅ Migration ${file} completed in ${Date.now() - mStartTime} ms.`);
        } catch (err) {
          await client.query('ROLLBACK');
          errorSync(`❌ Migration failed on file ${file}: ${err.message}`);
          errorSync(`Error Code: ${err.code || 'N/A'}`);
          errorSync(`Error Detail: ${err.detail || 'N/A'}`);
          throw err;
        }
      }
    }

    logSync(`🎉 All PostgreSQL database migrations executed successfully in ${Date.now() - startTime} ms!`);
  } catch (error) {
    errorSync(`❌ MIGRATION ERROR: ${error.message}`);
    if (error.stack) errorSync(`Stack: ${error.stack}`);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations().catch((err) => {
    errorSync(`FATAL: runMigrations CLI failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { runMigrations };
