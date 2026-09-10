# THEIAKSHI ONE

## Description
Enterprise HRMS application for managing attendance, assets, reports, and workforce data.

## Metrics
- Zero critical security vulnerabilities.
- Backend RBAC must be fully enforced on all API endpoints.

## Scope
- Full enterprise lifecycle spanning 20 engineering review phases.
- Comprehensive review of Architecture, Code Quality, Security, Database, UX, Performance, QA, and DevOps.
- Future phases will dictate specific functional scopes.

## Constraints
- Do not store application JWTs in localStorage.
- The authoritative roadmap dictates the sequence of engineering validations.

## Getting Started
Please refer to the [Documentation Index](INDEX.md) for a complete mapping of the project's architecture, security, database, and infrastructure.

## Locked Decisions
- RBAC mapped to SUPER_ADMIN, ADMIN, HR_MANAGER, OPERATIONAL_MANAGER, EMPLOYEE.
- Nginx reverse proxy routes /api/ traffic.
- JWTs must NOT be stored in localStorage.
