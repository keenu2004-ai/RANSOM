# THEIAKSHI ONE

## Description
Enterprise HRMS application for managing attendance, assets, reports, and workforce data.

## Metrics
- Zero critical security vulnerabilities.
- Backend RBAC must be fully enforced on all API endpoints.

## Scope
- Authentication via HTTP-Only cookies with MSAL SSO integration.
- Strict auth_version validation.

## Constraints
- Do not store application JWTs in localStorage.
- JWT auth_version === DB auth_version.

## Locked Decisions
- RBAC mapped to SUPER_ADMIN, HR_MANAGER, OPERATIONAL_MANAGER, EMPLOYEE.
- Nginx reverse proxy routes /api/ traffic.
