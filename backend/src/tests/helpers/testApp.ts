/**
 * testApp.ts — Express Application Factory for Integration Tests
 *
 * Creates the real Express application stack WITHOUT calling server.listen().
 * Tests receive the same middleware, authentication, authorization, CSRF,
 * validation, rate limiting, and routes as production — just without binding a port.
 *
 * IMPORTANT: The DB pool used by the application controllers is the application
 * pool (from src/db/index.ts), NOT the testPool. The testPool is only used for
 * direct DB assertions in test helpers. This ensures tests exercise the real
 * application stack end-to-end.
 *
 * The application pool is configured by the DATABASE_URL env var.
 * To point it at the test DB, we set DATABASE_URL = TEST_DATABASE_URL
 * before importing this module. This is done in the test files themselves
 * via the setup at the top of each file.
 */
import path from 'path';
import dotenv from 'dotenv';

// Load .env.test BEFORE importing server, so the app pool connects to the test DB
dotenv.config({ path: path.join(__dirname, '../../../../.env.test') });

// Override DATABASE_URL with TEST_DATABASE_URL for the application's pool
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DATABASE_SSL = 'false';
}

// Now import the real Express app (server.ts exports the app without listen())
// The import chain will use the test DATABASE_URL
import app from '../../server';

export default app;
