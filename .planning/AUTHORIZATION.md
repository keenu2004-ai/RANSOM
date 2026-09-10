# Authorization & RBAC Architecture

## Status
IMPLEMENTED & VERIFIED (Phase 10)

## Overview
Authorization in THEIAKSHI ONE relies entirely on **Server-Side Enforcement**. Frontend authorization is used strictly for UX (hiding/showing elements) and is NOT a security boundary.

## Backend Authorization (The Boundary)

### Roles
The system operates on a mapped Role-Based Access Control (RBAC) model. The core normalized roles are:
- `SUPER_ADMIN`
- `ADMIN`
- `HR_MANAGER`
- `OPERATIONAL_MANAGER`
- `EMPLOYEE`

### Middleware Enforcement
The `rbacMiddleware.ts` provides the `requireRole` middleware.
- Example: `router.get('/users', requireRole('SUPER_ADMIN', 'ADMIN'), ...)`
- If the JWT payload's role does not match the allowed roles, the server immediately returns `403 FORBIDDEN`.
- A `403` response does NOT log the user out (the session remains valid, but access is denied).

### Organization Isolation
Multi-tenant/organization boundaries are enforced dynamically via SQL parameters in the repository layer.
- Most queries require `WHERE organization_id = $1` mapping to `req.user.organizationId`.
- Super Admins may have elevated privileges across organizations depending on specific endpoint logic.

### Direct API Authorization
- **Files/Storage**: File access is verified against the user's role and organization.
- **Reports**: Bound to organization ID and role checks.
- **Settings/Audit Logs**: Strictly restricted to `SUPER_ADMIN` or `ADMIN`.

## Frontend Authorization (UX Only)

- The frontend utilizes a centralized `hasPermission` utility to conditionally render UI components.
- The `AuthContext` provides the current user's role to the React component tree.
- Hardcoded string role checks (e.g., `user.role === 'ADMIN'`) have been replaced with the semantic `hasPermission(role, 'ACTION')` mapper to decouple UI from exact string matches.

## Security Guarantees
- No user can escalate their privileges by manipulating the frontend code or localStorage.
- Changing a user's role in the database increments their `auth_version`, instantly invalidating their current active session and forcing them to re-authenticate to receive a newly minted JWT with their new role payload.
