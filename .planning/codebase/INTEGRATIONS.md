# Codebase Integrations

**Analysis Date:** 2026-09-09

## External APIs & Services
- **Microsoft Entra ID (SSO):** Used via `@azure/msal-browser` in the frontend and validated via `jwks-rsa` / JWKS endpoint in the backend for enterprise single sign-on authentication.
- **Google Cloud Storage / Google Drive:** Evidenced by `googleapis` and `@google-cloud/storage` in the backend `package.json` for backups or file storage.

## Databases
- **PostgreSQL:** Primary relational datastore (accessed via `pg` driver). Handles schema storage, `auth_version` tracking, and RBAC mapping.

## Authentication Providers
- **Custom JWT & Cookies:** The system uses HTTP-Only cookies backed by `jsonwebtoken` to securely transport identity and authenticate requests, validating against database `auth_version`.
- **Microsoft SSO:** Supported flow that exchanges MSAL token for application HTTP-Only cookie session.
