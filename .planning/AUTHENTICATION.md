# Authentication Architecture

## Status
IMPLEMENTED & VERIFIED (Phase 10)

## Overview
THEIAKSHI ONE uses a secure, HttpOnly cookie-based session mechanism for internal API access, augmented by Microsoft Entra ID (SSO) integration.

## Implemented Flows

### 1. Login (`POST /api/v1/auth/login`)
- Validates credentials (email/password or Microsoft SSO).
- Checks user account status (rejects `DEACTIVATED` / `INACTIVE`).
- Verifies password hash if native login (unless `ALLOW_PASSWORD_LOGIN='false'`).
- Generates a stateless JWT containing `userId`, `role`, `auth_version`, and `organizationId`.
- Returns an `HttpOnly`, `SameSite=Lax` cookie (`theiakshi_session`) containing the JWT.
- Automatically sets `Secure=true` in production (`config.env === 'production'`).
- Applies a strict rate limit (`authLimiter`: 20 requests per 15 minutes) to prevent brute forcing.

### 2. Session Validation (`GET /api/v1/auth/me` & Middleware)
- The `authenticate` middleware (`authMiddleware.ts`) extracts the JWT from the `theiakshi_session` cookie.
- If the token is missing, expired, or invalid, returns `401 UNAUTHENTICATED`.
- Cross-references the JWT `auth_version` claim with the database `users.auth_version`.
- If the token's `auth_version` is `<` the database version, returns `401 INVALID_TOKEN` (Session Invalidated).

### 3. Logout (`POST /api/v1/auth/logout`)
- Clears the `theiakshi_session` cookie by returning a `Set-Cookie` header with an expired epoch date.
- Required to be a `POST` request to prevent CSRF logout attacks.
- Requires valid `Origin` or `Referer` headers for CSRF protection.

### 4. Microsoft SSO (`POST /api/v1/auth/microsoft`)
- Accepts a Microsoft ID token from the frontend.
- Validates algorithm is `RS256`.
- Fetches Microsoft public keys via JWKS and verifies the JWT signature.
- **Audience Validation**: Verifies `aud === process.env.MICROSOFT_CLIENT_ID`.
- **Tenant Validation**: Verifies `tid === process.env.MICROSOFT_TENANT_ID`. Rejects personal accounts (`consumers`).
- **Issuer Validation**: Verifies `iss` matches expected Microsoft STS format for the specific tenant.
- **OID Binding**: Extracts the `oid` or `sub` to map to an internal user identity.

### 5. Session Invalidation (Auth Versioning)
The `auth_version` in the database is incremented (invalidating all active sessions) upon:
- Password changes
- Role changes
- Account deactivation

### 6. CSRF & CORS
- **CORS**: Configured in `server.ts` to strictly allow origins defined in `CORS_ALLOWED_ORIGINS`.
- **CSRF**: Any mutating method (`POST`, `PUT`, `PATCH`, `DELETE`) with a cookie session must provide a valid `Origin` or `Referer` header matching the allowed CORS origins. If missing, returns `403 CSRF_FAILED`.

## Storage
- **Frontend Storage**: The frontend does NOT store the JWT in `localStorage` or `sessionStorage`. It only stores a non-sensitive `theiakshi_explicit_logout` flag to handle UI state across tabs.
- **API Client**: The Vite proxy and Axios instances are configured to send credentials (cookies) automatically via `withCredentials: true`.

## Known Constraints
- The backend relies entirely on the HTTP-Only cookie. Bearer token compatibility exists for legacy or server-to-server scenarios, but web clients must use cookies.
