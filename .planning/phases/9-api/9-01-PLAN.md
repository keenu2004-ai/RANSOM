# Phase 9: API Design Review — Implementation Plan (Final)

## Goal
Implement URL Path-based API Versioning (`/api/v1/`) across the application to satisfy Phase 9 requirements, while strictly preserving authentication, session security, infrastructure configuration, and working tree state.

## Final Exit Condition
**Phase 9 is PASS only when:** Every intended API route is reachable under `/api/v1`, the frontend uses the versioned API successfully, authentication/RBAC/session behavior remains intact, production and local routing work, no unintended hardcoded API consumers remain, and all 17 verification gates pass.

---

## 1. Inventory & Route Migration Decision

### 17 Moduled Routes
The following explicitly registered routes in `backend/src/server.ts` will be migrated from `/api/[resource]` to `/api/v1/[resource]`:
1. `auth`
2. `dashboard`
3. `employees`
4. `attendance`
5. `leaves`
6. `holidays`
7. `expenses`
8. `timesheets`
9. `assets`
10. `calendar`
11. `notifications`
12. `reports`
13. `audit-logs`
14. `settings`
15. `admin`
16. `users`
17. `files`

### Decision on `/api/health`
The health check endpoint at `app.get('/api/health')` handles authoritative database verification. 
**Decision:** We will extract the real database-backed health-check logic into a reusable handler function. We will then mount this exact same handler to both `/api/v1/health` (the versioned endpoint) and `/api/health` (as a compatibility delegation for existing monitors). This guarantees no duplication of logic while preserving accurate health results for legacy infrastructure.

### Expected behavior of legacy `/api/...` routes
Legacy endpoints (e.g., `/api/auth/login` instead of `/api/v1/auth/login`) will NOT be supported and will intentionally return **404 Not Found**. No reverse-compatibility wrapper will be provided for legacy endpoints since this is an internal refactor. 

---

## 2. Proposed Implementation Changes

### Backend Refactor
#### [MODIFY] `backend/src/server.ts`
- Update `app.use('/api/', apiLimiter)` to `app.use('/api/v1/', apiLimiter)`.
- Update the 17 mapped routes to use `/api/v1/[resource]`.
- Refactor the database health check into a handler and bind it to both `/api/v1/health` and `/api/health`.

### Frontend Refactor
An exhaustive search of the frontend revealed hardcoded `/api/files/` routes that bypass the centralized client base string parsing.

#### [MODIFY] `frontend/src/services/api-client.ts`
- Update `getApiUrl` so it constructs endpoints using `${baseUrl}/api/v1${cleanEndpoint}`.
- Refactor the hardcoded `/api/files/` strings in `apiDownload`, `getSecureFileUrl`, etc., to use `/api/v1/files/`.

#### [MODIFY] `frontend/src/pages/Expenses.tsx`
- Refactor `receiptUrl: \`/api/files/${completeRes.attachment.id}/view\`` to use `/api/v1/files/`.

*(No changes to Docker, Nginx, Vite configs, Database Schema, or Auth Architecture)*

---

## 3. Mandatory Verification Gates

We will execute the following gates sequentially before marking Phase 9 complete.

1. **[ ] Inventory Verified:** Prove all 17 routes and `/api/health` migrated to `/api/v1`.
2. **[ ] Health Check Check:** Confirm `/api/health` and `/api/v1/health` both execute the authoritative database ping without duplicated logic.
3. **[ ] Frontend Scan:** Exhaustively search the entire `frontend/src` tree to confirm no hardcoded `/api/` paths, no direct `fetch`/`axios` calls, and no API URLs bypass the centralized API client (excluding documented operational endpoints like `/api/health`).
4. **[ ] VITE_API_URL Check:** Confirm `VITE_API_URL` parsing logic and empty-string fallback in `getApiUrl` remains perfectly intact for relative production routing.
5. **[ ] Vite Proxy Support:** Confirm the local Vite proxy configuration `^/api` naturally proxies `^/api/v1` without modification.
6. **[ ] Login Test:** Test `POST /api/v1/auth/login` works.
7. **[ ] Session Hydration:** Test `GET /api/v1/auth/me` works.
8. **[ ] Logout & Cookie:** Test `/api/v1/auth/logout` clears the HttpOnly cookie.
9. **[ ] Authenticated Access:** Verify an authenticated user can read API endpoints.
10. **[ ] RBAC Enforcement:** Test a 403 Forbidden boundary and confirm it does *not* clear the user's session.
11. **[ ] Auth Version Tracking:** Test `auth_version` invalidation on a stale session.
12. **[ ] Microsoft SSO:** Test the MSAL flow successfully establishes the application session cookie.
13. **[ ] 401 Rejection:** Verify unauthenticated requests correctly return 401.
14. **[ ] Legacy 404:** Verify an old `/api/dashboard` request correctly 404s.
15. **[ ] TypeScript Validation:** Run `npx tsc --noEmit` on both frontend and backend.
16. **[ ] Production Build:** Run `npm run build` on the frontend.
17. **[ ] Final Regression:** Perform a final holistic UI check.

---

## 4. Internal Critic Result

- **1. Scope limited to API versioning:** PASS. Changes strictly confined to `server.ts`, `api-client.ts`, and `Expenses.tsx`.
- **2. All 17 routes covered:** PASS. Inventoried and explicitly mapped to `/api/v1`.
- **3. /api/v1 is canonical namespace:** PASS. All business endpoints moved natively to `/api/v1`.
- **4. /api/health compatibility:** PASS. The authoritative DB logic is reused via handler delegation without duplicating logic.
- **5. Legacy routes return 404:** PASS. Explicitly enforced and documented; no legacy backward-compatibility wrappers.
- **6. Frontend consumers covered:** PASS. Direct scan caught hardcoded `/api/files/` bypasses in `api-client.ts` and `Expenses.tsx`.
- **7. Authentication architecture unchanged:** PASS. No modifications to `authController.ts`, MSAL config, or DB schema.
- **8. No DB schema changes:** PASS. No migrations needed or planned.
- **9. No infrastructure changes:** PASS. Vite and Nginx proxies native `^/api` wildcard behaviors are preserved and utilized.
- **10. Working-tree changes protected:** PASS. Only specifically targeted strings and file updates are planned.
- **11. Behavioral verification:** PASS. 12 of the 17 gates are end-to-end behavioral tests covering regressions.
- **12. 17-gate matrix and exit condition preserved:** PASS. The strict verification matrix and explicit exit condition govern completion.

**Internal Critic Result:** PASS
**Required Changes:** NONE
