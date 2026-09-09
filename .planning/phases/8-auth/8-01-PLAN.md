# Plan 8-01: Fix HTTP-Only Cookie Same-Origin Policy (Revised)

## Root Cause Diagnosis
The `theiakshi_session` HTTP-Only session cookie is not being persisted during local development. 
- In production, Nginx proxies `/api/` to the backend, maintaining a strictly Same-Origin architecture where `sameSite: 'lax'` works perfectly.
- In local development, `api-client.ts` falls back to `http://localhost:5000`, causing the frontend (`localhost:5173`) to make cross-origin requests. Browsers drop `sameSite: 'lax'` cookies when requests occur across differing origins/ports if they are considered cross-site (e.g., `127.0.0.1` vs `localhost`).
- The backend's `authController.ts` already correctly enforces `sameSite: 'lax'` and `path: '/'`. Modifying it is unnecessary.

## Fix Plan
1. **Scope fix to local development proxy:** Configure `frontend/vite.config.ts` to proxy `^/api` requests to `http://localhost:5000`. This mirrors the production Nginx proxy setup exactly, resolving CORS and SameSite origin discrepancies for local development.
2. **Update local fallback in API Client:** Modify `frontend/src/services/api-client.ts` so that if `VITE_API_URL` is unset, it defaults to the relative path `''` across ALL environments (both development and production). 
3. **Preserve `VITE_API_URL` configurability:** Keep the ability to read `VITE_API_URL` so that supported deployment modes requiring explicit API origins (e.g., separating frontend and backend without a reverse proxy) remain functional.

## Proposed Changes
### `frontend/vite.config.ts`
- Add `proxy: { '^/api': { target: 'http://localhost:5000', changeOrigin: true } }` to the `server` configuration.

### `frontend/src/services/api-client.ts`
- Change `baseUrl = import.meta.env.PROD ? '' : 'http://localhost:5000';` to simply `baseUrl = '';` when `VITE_API_URL` is unset.

*(No changes to `backend/src/controllers/authController.ts` or production infrastructure)*

## Verification Matrix
The following verification steps will be run to ensure full regression coverage:
- [ ] **TypeScript check:** Run `npx tsc --noEmit` on frontend and backend.
- [ ] **Frontend build:** Run `npm run build` to verify production bundling is unaffected.
- [ ] **Local proxy connectivity:** Ensure local frontend routes `/api` requests correctly through Vite.
- [ ] **Successful login:** Verify valid credentials yield 200 OK.
- [ ] **HttpOnly cookie creation:** Inspect browser to confirm `theiakshi_session` is set.
- [ ] **Cookie persistence:** Refresh the page to ensure the session is maintained.
- [ ] **`/auth/me` after refresh:** Verify the user object is correctly returned.
- [ ] **Logout clears session:** Verify logout unsets the cookie and clears frontend state.
- [ ] **Unauthenticated request returns 401:** Ensure protected API routes reject requests without the cookie.
- [ ] **Authenticated API request succeeds:** Ensure standard API interactions function correctly.
- [ ] **403 Authorization Failure:** Ensure unauthorized roles receive 403 without clearing session.
- [ ] **Production routing intact:** Verify production builds still utilize the intended relative API routing architecture.
- [ ] **No localStorage leakage:** Confirm JWT is not stored in localStorage.
- [ ] **No unexpected direct cross-origin API requests:** Verify Network tab shows only Same-Origin requests.

## Internal Critic Result
- **Is the fix actually limited to the diagnosed local-development problem?** YES.
- **Did we unnecessarily change backend authentication?** NO. `authController.ts` was removed from modifications.
- **Did we accidentally alter production authentication?** NO. Production relies on Nginx and relative paths, which remains unchanged.
- **Did we unnecessarily remove configurable API behavior?** NO. `VITE_API_URL` is explicitly preserved.
- **Does the proposed Vite proxy match the existing production `/api` routing?** YES. It perfectly mirrors the Nginx `location /api/` proxy pass.
- **Are all authentication regression cases covered?** YES, an extensive 14-point matrix is defined.
- **Are existing local changes protected?** YES, only two highly specific lines will be touched.
- **Result:** **PASS**. Ready for execution.
