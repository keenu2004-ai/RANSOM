# Database Architecture

## Overview
THEIAKSHI ONE uses PostgreSQL (version 18-alpine in Docker) for relational data storage. The application connects via the `pg` client library.

## Configuration & Connection
- **Provider**: PostgreSQL
- **Database Name**: `theiakshi_one` / `theiakshi_hrms`
- **Connection**: Managed via `DATABASE_URL` environment variable.
- **SSL**: Controlled by `DATABASE_SSL` environment variable (disabled for local development via `.env` injection).

## Migrations
- Schema and data migrations are executed automatically on application startup if changes are detected.
- **Current State**: 40 applied migrations.
- **Key Migrations**: Include schema definitions for roles, users, employees, attendance, leaves, and `auth_version` tracking.

## Core Schema
- **Organizations**: Isolates multi-tenant data.
- **Users**: Represents identities (includes `email`, `password_hash`, `auth_version`, `status`, `organization_id`).
- **Employees**: Represents workforce details (tied to `user_id` and `organization_id`).
- **Roles & Permissions**: Maps semantic roles to users (`user_roles`).
- **Attendance & Leaves**: Tracks employee timesheets and leave policies.
- **Assets & Expenses**: Tracks equipment and financial claims.

## Security & Constraints
- Passwords are strictly hashed using `bcryptjs` (salt rounds: 10) before storage.
- Passwords and secrets are NEVER exposed in database URL logs or API responses.
- `auth_version` is tracked as an integer in the `users` table and is central to session invalidation.
- Foreign key constraints ensure data consistency across organization boundaries.

## Known Risks & Performance
- Phase 11 (Database Optimization) successfully audited query and index paths. Core tables (`users`, `employees`, `expenses`, `trip_expenses`, `leave_balances`, `assets`, `attendance`) now have composite/foreign-key indexes (primarily `organization_id` and `user_id` combinations) to prevent sequential scans on tenant-bound analytics.
- Queries performing extensive grouping on JSON data or CTE analytics (`getManagementSummary`) should be monitored as datasets scale past 10,000s of rows.
