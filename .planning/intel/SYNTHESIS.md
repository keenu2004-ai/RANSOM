# THEIAKSHI ONE - Project Synthesis

## Scope
Enterprise HRMS application for managing attendance, assets, reports, and workforce data.

## Goals
- Provide secure HTTP-Only cookie-based authentication.
- Strict backend RBAC enforcement over UI capabilities.
- Support MSAL Microsoft SSO integration.

## Non-Goals
- Real-time chat.
- Advanced payroll processing (assumed out of scope for now).

## Constraints
- Must not store JWTs in localStorage.
- JWT auth_version must strictly match DB auth_version.

## Locked Decisions
- RBAC mapped to four roles: SUPER_ADMIN, HR_MANAGER, OPERATIONAL_MANAGER, EMPLOYEE.
- Nginx reverse proxy routes `/api/` traffic.
