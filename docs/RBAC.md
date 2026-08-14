# THEIAKSHI ENTERPRISE HRMS — ROLE-BASED ACCESS CONTROL (RBAC)

## Canonical Roles Matrix

### 1. `SUPER_ADMIN`
- **Scope**: Full system & global governance control
- **Employee Profile**: `NONE` (`employeeId = null`)
- **Capabilities**: Full access to all 18 modules, user account management, role & permissions matrix customization, system settings, immutable audit logs.

### 2. `ADMIN`
- **Scope**: Organization administrator
- **Employee Profile**: `NONE` (`employeeId = null`)
- **Capabilities**: Manage organization data, departments, designations, branches, users, roles, compliance, reports, audit logs. Operational overview endpoints never crash or require employeeId.

### 3. `HR_MANAGER`
- **Scope**: Personnel operations, talent acquisition, attendance, leave & payroll management
- **Employee Profile**: `EMP-001` (Aarav Sharma)
- **Capabilities**: Create/update employees, approve leave requests, review expense claims, manage payroll structures, statutory compliance, announcements.

### 4. `MANAGER`
- **Scope**: Team operations & project supervisor
- **Employee Profile**: `EMP-002` (Priya Verma)
- **Capabilities**: View team employees, approve team leave requests, review team expense claims, inspect timesheet logs, view workforce reports.

### 5. `EMPLOYEE`
- **Scope**: Self-service portal user
- **Employee Profile**: `EMP-003` (Rohan Gupta)
- **Capabilities**: Personal check-in / check-out, view personal leave balances, apply for leave, submit expense claims, log project timesheets, view personal payslips, access documents & helpdesk.
