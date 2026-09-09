# Codebase Structure

**Analysis Date:** 2026-09-09

## Directory Layout
- `/backend`: Node.js Express API server source code.
  - `src/`: Core backend application logic (Controllers, Middlewares, Services, Repositories).
  - `src/scripts/`: Tooling, migration runners, and integrity verification scripts.
- `/frontend`: React client SPA source code.
  - `src/`: Core UI application logic.
  - `src/pages/`: Route-level views (e.g., Attendance, Assets, Reports).
  - `src/services/`: API client fetching logic (`api-client.ts`).
  - `src/utils/`: Shared utilities (e.g., `permissions.ts`).
- `/database`: Database management.
  - `migrations/`: Sequence of `.sql` migration files.
  - `scripts/`: Node.js scripts for executing schema changes.
- `/docs`: Markdown documentation describing the system, RBAC, deployment, API, etc.
- `.planning/`: Project definition and knowledge graph artifacts for GSD workflow.

## Key Locations
- **Frontend Entry:** `frontend/src/main.tsx` and `frontend/src/App.tsx`
- **Backend Entry:** `backend/src/server.ts`
- **API Client:** `frontend/src/services/api-client.ts`
- **Backend Routing:** Defined within `backend/src/` routes files.
- **Security Checkers:** `backend/src/middleware/authMiddleware.ts`
