# Security Architecture & Controls

## Status
IMPLEMENTED & VERIFIED (Phase 10)

## Implemented Controls

### Authentication & Sessions
- **HTTP-Only Cookies**: JWTs are transmitted securely via `Set-Cookie` with `HttpOnly`, `SameSite=Lax`, and `Secure` (in production).
- **No Local Storage**: JWTs are explicitly NOT stored in `localStorage` or `sessionStorage` in the frontend, preventing XSS token exfiltration.
- **Auth Versioning**: Active sessions can be remotely invalidated by incrementing the `auth_version` in the database.
- **Brute Force Protection**: A strict rate limiter (20 requests / 15 minutes) protects all `/api/v1/auth` endpoints.
- **Deactivated Accounts**: Enforced blocking of logins for any user with `status = 'DEACTIVATED'` or `status = 'INACTIVE'`.

### Microsoft SSO
- **Strict Cryptographic Validation**: Validates signature using Microsoft's dynamically fetched JWKS (`RS256`).
- **Audience & Tenant Restrictions**: Hard failure if `aud` or `tid` do not strictly match configured environment variables.
- **Personal Account Blocking**: Explicitly rejects consumer/personal Microsoft accounts.

### Authorization (RBAC)
- **Server-Side Enforcement**: All business endpoints are protected by `authenticate` and `requireRole` middleware.
- **Tenant Isolation**: Database queries enforce `organization_id` boundaries.

### Network & CSRF
- **CSRF Protection**: All mutating API methods (`POST`, `PUT`, `DELETE`, `PATCH`) validate `Origin` and `Referer` headers against allowed CORS domains.
- **CORS Restrictions**: Explicit origin whitelisting via `CORS_ALLOWED_ORIGINS`.
- **Global Rate Limiting**: General API routes are protected by a 300 request / 15 minute rate limiter.

## Unverified / Planned (Future Phases)
- **Database Optimization (Phase 11)**: Performance and resource-exhaustion security.
- **Enterprise Security Audit (Phase 16)**: Final global penetration testing, compliance checking, and vulnerability scanning.
- **TLS Configuration**: Handled by Caddy proxy, but formal Cipher Suite auditing is deferred to Phase 16.
