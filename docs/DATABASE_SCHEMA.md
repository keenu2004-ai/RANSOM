# THEIAKSHI ENTERPRISE HRMS — DATABASE SCHEMA

## Schema Metrics
- **Total Relational Tables**: 35 PostgreSQL Tables
- **Tenancy Scoping**: `organization_id` foreign keys with cascade constraints
- **PrimaryKey Standard**: UUID via `gen_random_uuid()` (pgcrypto extension)

## Core Table Entities

### Identity & Auth
- `users` (`id`, `organization_id`, `email`, `password_hash`, `status`, `created_at`, `updated_at`)
- `roles` (`id`, `organization_id`, `name`, `description`, `is_system_role`)
- `permissions` (`id`, `module`, `action`, `description`, `key`)
- `user_roles` (`user_id`, `role_id`)
- `role_permissions` (`role_id`, `permission_id`)

### Core HR Master
- `employees` (`id`, `organization_id`, `user_id` FK -> `users.id`, `employee_code`, `first_name`, `last_name`, `email`, `phone`, `employment_type`, `status`, `branch_id`, `department_id`, `designation_id`, `team_id`, `manager_id`)
- `departments` (`id`, `organization_id`, `branch_id`, `name`, `code`)
- `designations` (`id`, `organization_id`, `department_id`, `name`, `code`)
- `teams` (`id`, `organization_id`, `department_id`, `name`, `code`)
- `branches` (`id`, `organization_id`, `name`, `code`, `location`, `is_headquarters`)

### Attendance & Locations
- `attendance_locations` (`id`, `organization_id`, `branch_id`, `name`, `latitude`, `longitude`, `radius_meters`)
- `attendance` (`id`, `organization_id`, `employee_id`, `date`, `check_in`, `check_out`, `status`, `working_hours`)
- `holidays` (`id`, `organization_id`, `branch_id`, `title`, `date`, `holiday_type`)

### Leaves & Financials
- `leave_types` (`id`, `organization_id`, `name`, `code`, `annual_quota`, `is_paid`)
- `leave_balances` (`id`, `organization_id`, `employee_id`, `leave_type_id`, `year`, `quota`, `used`, `pending`, `available`)
- `leave_requests` (`id`, `organization_id`, `employee_id`, `leave_type_id`, `start_date`, `end_date`, `total_days`, `reason`, `status`)
- `expense_categories` (`id`, `organization_id`, `name`, `code`)
- `expenses` (`id`, `organization_id`, `employee_id`, `category_id`, `amount`, `description`, `status`)
- `projects` (`id`, `organization_id`, `name`, `code`, `status`)
- `timesheets` (`id`, `organization_id`, `employee_id`, `project_id`, `date`, `hours`, `description`, `status`)
