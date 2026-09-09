# Codebase Testing Practices

**Analysis Date:** 2026-09-09

## Testing Strategy
- **Unit and Integration Scripts:** Instead of standard testing frameworks (like Jest/Mocha), the repository currently utilizes specialized `.ts` verification scripts located within `backend/src/scripts/` (e.g., `verify_cookie_auth.ts`, `measure_attendance_performance.ts`). These scripts programmatically test endpoint authorization rules, database boundaries, and system latency.

## Verification
- Code compilation is validated via `npx tsc --noEmit` on both frontend and backend to ensure TypeScript type safety across the monolith boundary.

## Gaps
- Lack of a standard test runner (Jest/Vitest) implies that automated CI pipeline tests are executed by invoking manual scripts rather than a unified suite.
