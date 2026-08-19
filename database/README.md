# THEIAKSHI ENTERPRISE HRMS — DATABASE ARCHITECTURE & SCHEMA

This directory contains the PostgreSQL source-of-truth database scripts, migrations, baseline seeds, and verification utilities for **THEIAKSHI ENTERPRISE HRMS**.

---

## Table Classifications

### 1. Scoping & Infrastructure
- `organizations` — Core tenant organization entity
- `organization_settings` — Tenant configuration (currency, timezone, fiscal year)
- `branches` — Organizational locations / headquarters

### 2. Identity & Access Management (IAM)
- `users` — Login & authentication identity (`email`, `password_hash`, `status`)
- `roles` — Authorization levels (`SUPER_ADMIN`, `ADMIN`, `HR_MANAGER`, `MANAGER`, `EMPLOYEE`)
- `permissions` — System permission definitions
- `user_roles` — Junction table linking users to roles
- `role_permissions` — Junction table linking roles to permissions

### 3. Core HR Master Data
- `departments` — Organizational departments
- `designations` — Job titles and designations
- `teams` — Operational teams within departments
- `employees` — Workforce identity record (contains `user_id` FK referencing `users.id`)
- `attendance_locations` — Geofencing locations (lat/lng/radius)
- `leave_types` — Quota rules and paid/unpaid classifications
- `expense_categories` — Allowed expense claim types
- `projects` — Internal and operational projects
- `document_types` — Compliance document definitions
- `statutory_rules` — EPF, ESI, PT, and TDS tax rules
- `holidays` — Company and national holiday calendar

### 4. Transactional Data (Starts Empty Until User Operations)
- `attendance` — Employee check-in / check-out records
- `leave_balances` — Calculated leave balances per employee per year
- `leave_requests` — Employee submitted leave applications
- `expenses` — Submitted expense reimbursement claims
- `timesheets` — Daily project hours logged
- `compliance_tasks` — Statutory filing and compliance tracking tasks
- `documents` — Employee uploaded document attachments
- `announcements` — Published company news and notices
- `notifications` — In-app alerts for users
- `helpdesk_tickets` — IT/HR support tickets
- `ticket_comments` — Support ticket discussion thread
- `audit_logs` — Immutable audit trail for system mutations

---

## Canonical Identity Relationship

```
     [users] (authentication identity)
        │
        │ 1:1 (user_id ON employees table)
        ▼
   [employees] (workforce identity)
```

- `users.id` and `employees.id` are separate primary keys.
- `employees.user_id` is a nullable foreign key pointing to `users.id`.
- Accounts with `SUPER_ADMIN` or `ADMIN` roles do not require a linked `employees` record (`user_id = null`).
