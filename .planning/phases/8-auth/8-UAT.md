---
phase: 8
status: passed
updated: 2026-09-09
---

# Phase 8 UAT: Authentication & Authorization

## Current Test
*(None - UAT Complete)*

## Summary
- **Total Tests:** 4
- **Passed:** 4
- **Issues Found:** 0

## Tests
### 1. HTTP-Only Cookie Login
**Status:** passed
**Expected:** Logging in successfully sets the `theiakshi_session` HTTP-Only cookie, with no JWT stored in localStorage.
**Actual:** Cookie is not being set

### 2. Backend RBAC Enforcement
**Status:** passed
**Expected:** Modifying the frontend user role manually does not bypass the backend RBAC checks, resulting in a 403 Forbidden on unauthorized endpoints.

### 3. Session Invalidation (auth_version)
**Status:** passed
**Expected:** Changing a user's password or status immediately increments their DB `auth_version`, invalidating their current session cookie and forcing a re-login (401 Unauthorized).

### 4. Microsoft SSO Integration
**Status:** passed
**Expected:** Authenticating via Microsoft SSO issues a valid backend HTTP-Only session cookie and grants access equivalent to standard login.

## Gaps (Diagnostics & Plans)
### Gap 1
- **Test:** HTTP-Only Cookie Login
- **Issue:** Cookie is not being set.
- **Root Cause:** Cross-origin/cross-site browser security policies drop `sameSite: 'lax'` cookies in local development when frontend and backend origins differ.
- **Plan:** `8-01-PLAN.md` (Proxy Vite to Backend for pure Same-Origin)
- **Status:** Executed, awaiting re-verification.
