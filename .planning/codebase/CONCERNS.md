# Codebase Concerns

**Analysis Date:** 2026-09-09

## Security & Reliability
- **Verification Suites:** Relying strictly on standalone Node scripts (e.g. `src/scripts/`) for continuous integration validation rather than formal testing structures like Jest/Cypress.
- **Role Scalability:** Current RBAC is hardcoded against four literal string roles (`SUPER_ADMIN`, `HR_MANAGER`, `OPERATIONAL_MANAGER`, `EMPLOYEE`). Extending this matrix may require code changes rather than just database config updates.

## Technical Debt
- **Frontend Fallbacks:** There was a known issue with the frontend attempting to fall back to `http://localhost:5000` in production if `VITE_API_URL` was unset, which has been patched to fall back to the empty relative path.
- **Frontend UI State:** Many frontend views rely heavily on `useAuth().user` objects. While now correctly derived from the API backend authority and not local storage, misconfigured caching layers on Nginx could potentially serve stale user identities if not careful.

## Operational Fragility
- **Database Migrations:** Executed sequentially via custom scripting logic in `database/scripts/migrate.js` rather than a robust ORM or industry-standard migration runner (e.g., Prisma, Knex).
