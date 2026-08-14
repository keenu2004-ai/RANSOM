# THEIAKSHI ENTERPRISE HRMS

Production-Grade Human Resource Management System (**THEIAKSHI ENTERPRISE HRMS**) built with strict 3-tier clean architecture: **Frontend (React + Vite + TypeScript + Tailwind CSS)**, **Backend (Node.js + Express + TypeScript + pg)**, and **Database (PostgreSQL Source of Truth — Neon PostgreSQL compatible)**.

---

## Workspace Structure

```
THEIAKSHI-ENTERPRISE-HRMS/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── services/
│   │   │   └── api-client.ts    # Centralized API Client (getApiUrl & apiFetch)
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── .env.example
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── db/                 # PostgreSQL Pool & Transaction Helpers
│   │   ├── middleware/         # authMiddleware, rbacMiddleware, requireEmployee, errorHandler
│   │   ├── repositories/       # Parameterized SQL Repositories
│   │   ├── routes/             # All 18 Modular Express REST Routers
│   │   ├── scripts/            # Integration & Test Suites
│   │   └── server.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── database/
│   ├── schema.sql              # PostgreSQL DDL Schema (35 Relational Tables)
│   ├── migrations/             # 001_initial_schema.sql
│   ├── seeds/                  # 001_baseline.sql (Idempotent Seed Script)
│   ├── scripts/                # migrate.js, seed.js, verify.js, integrity-check.js
│   └── README.md
├── docs/
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── API_DOCUMENTATION.md
│   ├── RBAC.md
│   ├── DEPLOYMENT.md
│   ├── TESTING.md
│   └── TROUBLESHOOTING.md
├── render.yaml                 # Render Production Blueprint
├── README.md
└── .gitignore
```

---

## Demo Credentials Matrix (Development Only)

All demo account passwords are set to **`ChangeMe@123`** (stored as bcrypt hashes in PostgreSQL).

| Role | Email | Password | Employee Profile | Primary Scope |
|---|---|---|---|---|
| **SUPER_ADMIN** | `superadmin@theiakshi.com` | `ChangeMe@123` | `NONE` (`null`) | Full System & Global Governance |
| **ADMIN** | `admin@theiakshi.com` | `ChangeMe@123` | `NONE` (`null`) | Organization Administration |
| **HR_MANAGER** | `hr@theiakshi.com` | `ChangeMe@123` | `EMP-001` (Aarav Sharma) | HR, Attendance, Leave & Payroll Operations |
| **MANAGER** | `manager@theiakshi.com` | `ChangeMe@123` | `EMP-002` (Priya Verma) | Team Supervision & Approvals |
| **EMPLOYEE** | `employee@theiakshi.com` | `ChangeMe@123` | `EMP-003` (Rohan Gupta) | Self-Service Portal |

---

## Quick Start & Installation

### 1. Database Setup
Ensure PostgreSQL is running and set your connection string:
```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/theiakshi_hrms
```

Run migrations, baseline seed, and integrity verification:
```bash
cd backend
npm run db:migrate    # Loads 35 PostgreSQL relational tables
npm run db:seed       # Idempotently inserts baseline master data & 5 accounts
npm run db:verify     # Audits baseline table count metrics
npm run db:integrity  # Audits relational foreign keys & tenancy scoping
```

### 2. Backend Server Development
```bash
cd backend
npm install
npm run dev           # Starts API server on http://localhost:5000
```

### 3. Frontend Application Development
```bash
cd frontend
npm install
npm run dev           # Starts Vite dev server on http://localhost:5173
```

---

## Production Build Verification
- **Backend Build**: `cd backend && npm run build` (Compiles TypeScript to `dist/`)
- **Frontend Build**: `cd frontend && npm run build` (Compiles Vite production bundle to `dist/`)

---

## Key System Highlights & Identity Rules
1. **Source of Truth**: PostgreSQL is the single source of truth for all modules. No mock data in production.
2. **Identity Architecture (`USER` ≠ `EMPLOYEE` ≠ `ROLE`)**:
   - `users.id`, `employees.id`, `roles.id` are separate identifiers.
   - Linkage: `employees.user_id` pointing to `users.id`.
   - `users.employee_id` is nullable. Administrative accounts (`superadmin@theiakshi.com` & `admin@theiakshi.com`) operate seamlessly with `employeeId = null`.
3. **Reusable Guard (`requireEmployee`)**:
   - Returns structured HTTP 400 error `{ success: false, error: "This action requires a linked employee profile.", code: "EMPLOYEE_PROFILE_REQUIRED" }` for personal check-in/out, leave apply, timesheets, expenses.
   - Administrative overview endpoints (`/employees`, `/leaves`, `/attendance`, `/reports`) never require `employeeId`.
4. **Centralized API Client**: All frontend requests resolve via `getApiUrl()` and `apiFetch()`. Express errors map to structured HTTP status codes (401, 403, 400, 404, 409, 500) and user-facing messages.
