# THEIAKSHI ENTERPRISE HRMS — API SPECIFICATION

## Base URL
Production: `${VITE_API_URL}/api/...`  
Development: `http://localhost:5000/api/...`

All requests use standard JSON headers: `Content-Type: application/json` and `Authorization: Bearer <token>`.

## Endpoint Matrix

| Method | Endpoint | Description | Auth Required | Employee Required | Allowed Roles |
|---|---|---|---|---|---|
| GET | `/health` | Health Check & PostgreSQL ping | No | No | Public |
| POST | `/auth/login` | Authenticate user & issue 24h JWT | No | No | Public |
| GET | `/auth/me` | Fetch authenticated user context | Yes | No | All |
| POST | `/auth/logout` | Revoke auth session | Yes | No | All |
| GET | `/dashboard` | Role-tailored metrics & announcements | Yes | No | All |
| GET | `/employees` | List/search employees with pagination | Yes | No | SUPER_ADMIN, ADMIN, HR_MANAGER, MANAGER |
| POST | `/employees` | Create employee profile & leave balances | Yes | No | SUPER_ADMIN, ADMIN, HR_MANAGER |
| GET | `/attendance/today` | Personal today attendance status | Yes | No | All |
| POST | `/attendance/check-in` | Personal workday check-in | Yes | Yes (400 if null) | All |
| POST | `/attendance/check-out` | Personal workday check-out | Yes | Yes (400 if null) | All |
| GET | `/attendance/workforce-summary` | Administrative daily workforce stats | Yes | No | SUPER_ADMIN, ADMIN, HR_MANAGER, MANAGER |
| GET | `/leaves/me/balance` | Personal leave balances | Yes | Yes | All |
| POST | `/leaves/apply` | Submit personal leave application | Yes | Yes | All |
| GET | `/leaves` | Administrative leave overview | Yes | No | SUPER_ADMIN, ADMIN, HR_MANAGER, MANAGER |
| PUT | `/leaves/:id/approve` | Approve leave application | Yes | No | SUPER_ADMIN, ADMIN, HR_MANAGER, MANAGER |
| PUT | `/leaves/:id/reject` | Reject leave application | Yes | No | SUPER_ADMIN, ADMIN, HR_MANAGER, MANAGER |
| GET | `/expenses/my` | Personal expense claims | Yes | Yes | All |
| POST | `/expenses` | Submit expense claim in ₹ INR | Yes | Yes | All |
| GET | `/expenses` | Administrative expense overview | Yes | No | SUPER_ADMIN, ADMIN, HR_MANAGER, MANAGER |
| GET | `/reports/export-csv` | Download employee report CSV | Yes | No | SUPER_ADMIN, ADMIN, HR_MANAGER, MANAGER |
| GET | `/audit-logs` | Immutable system audit log trail | Yes | No | SUPER_ADMIN, ADMIN |
| GET | `/admin/users` | Admin control panel user accounts | Yes | No | SUPER_ADMIN, ADMIN |
