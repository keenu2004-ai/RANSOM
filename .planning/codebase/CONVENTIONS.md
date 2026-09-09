# Codebase Conventions

**Analysis Date:** 2026-09-09

## Coding Standards
- **Language:** TypeScript with strict type checking.
- **Frontend Components:** Functional React components utilizing React Hooks (`useState`, `useEffect`, `useCallback`). 
- **Styling:** Tailwind CSS utility classes directly on JSX elements.

## Error Handling
- **Backend:** Centralized error structures thrown and caught, resulting in generic HTTP response codes (e.g., `401 Unauthorized` without leaking implementation details).
- **Frontend:** API fetch failures correctly intercepted by `api-client.ts`, which throws structured `ApiError` exceptions and triggers the `theiakshi:auth:logout` event on `401`.

## Security Patterns
- **Authentication:** Strict avoidance of `localStorage` for sensitive tokens. JWT authentication is handled entirely through HTTP-Only cookies.
- **Authorization:** Backend RBAC middleware dictates capabilities. The frontend UI conditionally renders via centralized `hasPermission` utility checks.
- **Session Revocation:** Passwords, status, or role changes increment the `auth_version` counter in PostgreSQL, causing immediate downstream invalidation of outstanding session cookies.
