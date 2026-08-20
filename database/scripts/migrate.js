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
  logSync('🔄 Connecting to PostgreSQL database...');
  logSync(`[DB] CWD: ${process.cwd()}`);
  logSync(`[DB] __dirname: ${__dirname}`);

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

    // 1. Execute Baseline Schema DDL Statement by Statement
    const schemaPath = path.resolve(__dirname, '../schema.sql');
    logSync(`[DB] Schema path: ${schemaPath}`);

    if (fs.existsSync(schemaPath)) {
      const stats = fs.statSync(schemaPath);
      logSync(`[DB] Schema file size: ${stats.size} bytes`);
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      logSync(`[DB] Schema snippet: ${schemaSql.slice(0, 100).replace(/\n/g, ' ')}`);

      logSync('📜 Executing baseline schema DDL (schema.sql)...');
      const statements = splitSqlStatements(schemaSql);
      logSync(`[DB] Parsed schema statements: ${statements.length}`);

      for (let idx = 0; idx < statements.length; idx++) {
        const stmt = statements[idx];
        if (!hasExecutableSql(stmt.sql)) {
          logSync(`[DB] Skipping non-executable stmt #${idx + 1}`);
          continue;
        }

        const preview = stmt.sql.split('\n').filter(l => l.trim() && !l.trim().startsWith('--'))[0] || stmt.sql;
        logSync(`[DB] Executing stmt #${idx + 1} (Lines ${stmt.startLine}-${stmt.endLine}): ${preview.slice(0, 120)}`);

        try {
          await client.query(stmt.sql);
        } catch (err) {
          errorSync('\n❌ FAILED SCHEMA STATEMENT:');
          errorSync(`Statement #${idx + 1} (Lines ${stmt.startLine}-${stmt.endLine})`);
          errorSync(`Preview: ${stmt.sql.slice(0, 200)}`);
          errorSync(`PostgreSQL Error: ${err.message}`);
          errorSync(`Error Code: ${err.code || 'N/A'}`);
          errorSync(`Error Detail: ${err.detail || 'N/A'}`);
          errorSync(`Error Hint: ${err.hint || 'N/A'}`);
          errorSync(`Error Position: ${err.position || 'N/A'}`);
          errorSync(`Error Stack: ${err.stack || 'N/A'}\n`);
          throw err;
        }
      }
      logSync('✅ Baseline schema loaded successfully.');
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
            logSync(`✅ Applied migration: ${file}`);
          } catch (err) {
            await client.query('ROLLBACK');
            errorSync(`❌ Migration failed on file ${file}: ${err.message}`);
            errorSync(`Error Code: ${err.code || 'N/A'}`);
            errorSync(`Error Detail: ${err.detail || 'N/A'}`);
            errorSync(`Error Stack: ${err.stack || 'N/A'}`);
            throw err;
          }
        } else {
          logSync(`⏭️ Migration already applied: ${file}`);
        }
      }
    }

    logSync('🎉 All PostgreSQL database migrations executed successfully!');
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
