/**
 * jest.config.js — Jest configuration for the HRMS backend test suite.
 *
 * The backend tsconfig.json uses:
 *   module: CommonJS, target: ES2022, strict: true, esModuleInterop: true
 *
 * ts-jest is configured to match these settings exactly.
 * Tests run sequentially (maxWorkers: 1) to prevent DB connection pool exhaustion.
 * forceExit: true ensures the process terminates when all tests complete.
 *
 * ESM Compatibility Note:
 * ─────────────────────────────────────────────────────────────────────────────
 * jwks-rsa (used by microsoftAuthService.ts) depends on 'jose' which is an
 * ESM-only module. Jest runs in CommonJS mode. We provide a manual mock at
 * src/tests/__mocks__/jwks-rsa.js via moduleNameMapper so the module graph
 * loads cleanly without hitting the ESM boundary.
 *
 * This does NOT weaken any production code — the mock is test-only and
 * jwks-rsa itself is not called in email/password or JWT Bearer auth flows.
 * ─────────────────────────────────────────────────────────────────────────────
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: './src',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'ES2022',
          module: 'CommonJS',
          strict: false, // Relax for test files only
          esModuleInterop: true,
          skipLibCheck: true,
          resolveJsonModule: true,
          forceConsistentCasingInFileNames: false
        }
      }
    ]
  },
  // Map ESM-only modules to CommonJS-compatible mocks so Jest can load them
  moduleNameMapper: {
    // jwks-rsa → jose → ESM-only. Replace with a safe stub for tests.
    '^jwks-rsa$': '<rootDir>/tests/__mocks__/jwks-rsa.js'
  },
  // Allow real DB round-trips and HTTP requests to complete
  testTimeout: 30000,
  // Sequential to prevent pg pool exhaustion
  maxWorkers: 1,
  // Detailed output per test for CI audit trails
  verbose: true,
  // Terminate even if there are open handles (e.g., pg pool)
  forceExit: true,
  // Global environment setup — loads .env.test before any test runs
  globalSetup: './tests/setup/globalSetup.ts',
  // Coverage configuration
  collectCoverageFrom: [
    'middleware/**/*.ts',
    'services/authService.ts',
    'config/permissions.ts',
    '!**/*.d.ts'
  ],
  coverageDirectory: '../coverage',
  coverageThresholds: {
    // Sensible initial thresholds — will increase incrementally
    global: {
      statements: 30,
      branches: 20,
      functions: 30,
      lines: 30
    }
  }
};
