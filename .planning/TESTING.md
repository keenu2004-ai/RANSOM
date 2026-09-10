# Testing & Quality Assurance (QA)

## Status
PARTIAL (Full formalization planned for Phase 14)

## Overview
THEIAKSHI ONE currently relies on a hybrid approach of static structural checks, TypeScript compilation verification, and manual/automated behavioral scripts executed during the engineering review phases.

## Current Testing Methods

### 1. Structural Checks (Automated)
- **TypeScript Compilation**: `npx tsc --noEmit` is used to verify type safety across the backend and frontend codebases.
- **Static Analysis**: ESLint and other linters enforce code quality (established in Phase 2).

### 2. Behavioral Verification (Manual / Scripted)
- **Phase Validation**: During engineering reviews (e.g., Phase 10 Authentication), dedicated Node.js scripts (like `test_auth_version.js`, `test_deactivated.js`) are written to execute behavioral E2E tests against the active local environment.
- **Proxy Validation**: Verification of Nginx/Vite proxy routing involves live `curl` or `fetch` requests to ensure headers and origin constraints behave correctly in practice, not just in configuration.

## Missing QA Elements (Blocked / Pending)
- **Automated E2E Suite**: There is currently no unified Cypress or Playwright test suite.
- **Unit Testing**: Jest/Mocha tests for individual controllers and services are lacking comprehensive coverage.
- **CI Enforcement**: While GitHub Actions or similar pipelines may exist, mandatory passing of a full behavioral test suite before merge is not fully mature.

## Future Plans
- **Phase 14 (Testing & QA)**: Will focus exclusively on building the automated E2E and unit testing infrastructure.
