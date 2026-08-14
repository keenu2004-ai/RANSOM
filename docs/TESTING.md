# THEIAKSHI ENTERPRISE HRMS — TESTING & ACCEPTANCE PROCEDURES

## Database Verification Pipeline
Run database pipeline scripts inside `backend/` or `database/`:
```bash
npm run db:migrate    # Executes PostgreSQL DDL & migrations
npm run db:seed       # Idempotently seeds baseline master data & 5 accounts
npm run db:verify     # Verifies non-zero baseline counts
npm run db:integrity  # Audits relational foreign keys & tenancy scoping
```

## Auth & Integration Suite
Execute backend integration test:
```bash
node backend/src/scripts/test-auth.js
```
This tests:
1. `GET /api/health`
2. `POST /api/auth/login` for all 5 demo accounts
3. `employeeId = null` handling for pure admin accounts
4. `GET /api/auth/me` token decoding
