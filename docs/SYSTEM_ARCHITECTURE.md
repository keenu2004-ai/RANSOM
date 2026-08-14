# THEIAKSHI ENTERPRISE HRMS — SYSTEM ARCHITECTURE

## Overview
THEIAKSHI ENTERPRISE HRMS is a production-grade 3-tier Human Resource Management System. It features strict layer separation between **Frontend (React + Vite + Tailwind CSS)**, **Backend (Node.js + Express + TypeScript + pg)**, and **Database (PostgreSQL / Neon)**.

```
       [ FRONTEND ] (React + Vite + Tailwind CSS)
            │
            │ HTTPS REST API Calls (Centralized api-client.ts)
            ▼
       [ BACKEND ] (Node.js + Express + TypeScript + pg)
            │
            │ Parameterized SQL Repositories & Connection Pool
            ▼
       [ DATABASE ] (PostgreSQL / Neon)
```

## Core Architectural Guarantees
1. **Source of Truth**: PostgreSQL is the single source of truth for all modules.
2. **Canonical Identity Architecture**:
   - `users.id`, `employees.id`, `roles.id` are decoupled.
   - Linkage: `employees.user_id` pointing to `users.id`.
   - `users.employee_id` is nullable. Administrative accounts (`SUPER_ADMIN`, `ADMIN`) operate seamlessly with `employeeId = null`.
3. **RBAC Guard Enforcement**: Authenticated JWT requests decode `{ userId, organizationId, email, role, employeeId }`. Middleware enforces role and permission rules at backend entry points.
