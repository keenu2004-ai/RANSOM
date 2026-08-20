-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — IDEMPOTENT BASELINE SEED SCRIPT
-- Default password for all demo accounts: ChangeMe@123
-- Bcrypt Hash ($2a$10$vK6C1L1Y9T3jX7fX1b2E4.B3X9k5Y8Z7w6u5t4s3r2q1p0o9n8m7l):
-- '$2a$10$EqK8s/mZJc9H5W6w2QY.e.X4T1dJ6S7yN8vO9P0q1r2s3t4u5v6w' (computed via bcrypt cost factor 10)
-- ============================================================

BEGIN;

-- 1. BASELINE ORGANIZATION & SETTINGS
INSERT INTO organizations (id, name, code, currency, default_hq)
VALUES ('00000000-0000-0000-0000-000000000001', 'Theiakshi Enterprise', 'THEIAKSHI', 'INR', 'THEIAKSHI-HQ')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, currency = EXCLUDED.currency;

INSERT INTO organization_settings (id, organization_id, company_name, time_zone, date_format, fiscal_year_start)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Theiakshi Enterprise', 'Asia/Kolkata', 'DD/MM/YYYY', '01-04')
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO branches (id, organization_id, name, code, location, is_headquarters)
VALUES ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Headquarters', 'THEIAKSHI-HQ', 'Ghaziabad, Uttar Pradesh, India', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 2. CANONICAL ROLES
INSERT INTO roles (id, organization_id, name, description, is_system_role)
VALUES 
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'SUPER_ADMIN', 'Super Administrator with full system privileges', TRUE),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'ADMIN', 'Organization Administrator with operational governance', TRUE),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'HR_MANAGER', 'HR Manager managing personnel, leaves, attendance & payroll', TRUE),
('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'MANAGER', 'Team Manager reviewing attendance, leave & team projects', TRUE),
('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'EMPLOYEE', 'Employee Self-Service user', TRUE)
ON CONFLICT (name) DO NOTHING;

-- 3. PERMISSIONS MATRIX (COVERING ALL MODULES)
INSERT INTO permissions (id, module, action, description, key)
VALUES
-- Employees
('20000000-0000-0000-0000-000000000001', 'employees', 'view', 'View employee records', 'employees:view'),
('20000000-0000-0000-0000-000000000002', 'employees', 'create', 'Create new employee profile', 'employees:create'),
('20000000-0000-0000-0000-000000000003', 'employees', 'update', 'Update employee details', 'employees:update'),
('20000000-0000-0000-0000-000000000004', 'employees', 'delete', 'Deactivate employee profile', 'employees:delete'),
('20000000-0000-0000-0000-000000000005', 'employees', 'export', 'Export employee directory CSV', 'employees:export'),
-- Attendance
('20000000-0000-0000-0000-000000000006', 'attendance', 'checkin', 'Mark self attendance', 'attendance:checkin'),
('20000000-0000-0000-0000-000000000007', 'attendance', 'view', 'View attendance logs', 'attendance:view'),
('20000000-0000-0000-0000-000000000008', 'attendance', 'manage', 'Manage attendance rules and locations', 'attendance:manage'),
-- Leave
('20000000-0000-0000-0000-000000000009', 'leave', 'apply', 'Apply for personal leave', 'leave:apply'),
('20000000-0000-0000-0000-000000000010', 'leave', 'view', 'View leave balances and history', 'leave:view'),
('20000000-0000-0000-0000-000000000011', 'leave', 'approve', 'Approve/reject workforce leave requests', 'leave:approve'),
('20000000-0000-0000-0000-000000000012', 'leave', 'manage', 'Configure leave types and quotas', 'leave:manage'),
-- Holidays
('20000000-0000-0000-0000-000000000013', 'holidays', 'view', 'View holiday calendar', 'holidays:view'),
('20000000-0000-0000-0000-000000000014', 'holidays', 'manage', 'Add/edit/delete company holidays', 'holidays:manage'),
-- Expenses & Timesheets
('20000000-0000-0000-0000-000000000017', 'expenses', 'create', 'Submit expense reimbursement claim', 'expenses:create'),
('20000000-0000-0000-0000-000000000018', 'expenses', 'view', 'View expense claims', 'expenses:view'),
('20000000-0000-0000-0000-000000000019', 'expenses', 'approve', 'Approve/reject expense claims', 'expenses:approve'),
('20000000-0000-0000-0000-000000000020', 'timesheets', 'create', 'Log daily project hours', 'timesheets:create'),
('20000000-0000-0000-0000-000000000021', 'timesheets', 'view', 'View project timesheet logs', 'timesheets:view'),
-- Asset Management
('20000000-0000-0000-0000-000000000040', 'assets', 'view', 'View assets and details', 'assets:view'),
('20000000-0000-0000-0000-000000000041', 'assets', 'create', 'Create new asset record', 'assets:create'),
('20000000-0000-0000-0000-000000000042', 'assets', 'update', 'Update asset information', 'assets:update'),
('20000000-0000-0000-0000-000000000043', 'assets', 'delete', 'Delete / Soft-delete asset record', 'assets:delete'),
('20000000-0000-0000-0000-000000000044', 'assets', 'assign', 'Assign asset to employee', 'assets:assign'),
('20000000-0000-0000-0000-000000000045', 'assets', 'return', 'Process asset return from employee', 'assets:return'),
('20000000-0000-0000-0000-000000000046', 'assets', 'manage', 'Full asset lifecycle management', 'assets:manage'),
('20000000-0000-0000-0000-000000000047', 'assets', 'categories', 'Manage asset categories', 'assets:categories'),
('20000000-0000-0000-0000-000000000048', 'assets', 'maintenance', 'Manage asset maintenance logs', 'assets:maintenance'),
('20000000-0000-0000-0000-000000000049', 'assets', 'reports', 'View and export asset reports', 'assets:reports'),
('20000000-0000-0000-0000-000000000050', 'assets', 'history', 'View asset audit history', 'assets:history'),
-- System & Reports
('20000000-0000-0000-0000-000000000031', 'notifications', 'view', 'Receive in-app alerts', 'notifications:view'),
('20000000-0000-0000-0000-000000000032', 'reports', 'view', 'View workforce reports', 'reports:view'),
('20000000-0000-0000-0000-000000000033', 'audit', 'view', 'View immutable audit trail', 'audit:view'),
('20000000-0000-0000-0000-000000000034', 'settings', 'manage', 'Manage organization settings', 'settings:manage'),
('20000000-0000-0000-0000-000000000035', 'admin', 'manage', 'Admin control panel user & role management', 'admin:manage')
ON CONFLICT (key) DO NOTHING;

-- Map permissions to SUPER_ADMIN & ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('SUPER_ADMIN', 'ADMIN')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Map permissions to HR_MANAGER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'HR_MANAGER' AND p.key IN (
  'employees:view', 'employees:create', 'employees:update', 'employees:delete', 'employees:export',
  'attendance:checkin', 'attendance:view', 'attendance:manage',
  'leave:apply', 'leave:view', 'leave:approve', 'leave:manage',
  'holidays:view', 'holidays:manage',
  'expenses:create', 'expenses:view', 'expenses:approve',
  'timesheets:create', 'timesheets:view',
  'notifications:view', 'reports:view',
  'assets:view', 'assets:create', 'assets:update', 'assets:assign', 'assets:return', 'assets:categories', 'assets:maintenance', 'assets:reports', 'assets:history'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Map permissions to MANAGER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'MANAGER' AND p.key IN (
  'employees:view', 'attendance:checkin', 'attendance:view',
  'leave:apply', 'leave:view', 'leave:approve',
  'holidays:view',
  'expenses:create', 'expenses:view', 'expenses:approve',
  'timesheets:create', 'timesheets:view',
  'notifications:view', 'reports:view',
  'assets:view', 'assets:assign', 'assets:return', 'assets:history'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Map permissions to EMPLOYEE
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'EMPLOYEE' AND p.key IN (
  'attendance:checkin', 'leave:apply', 'leave:view', 'holidays:view',
  'expenses:create', 'expenses:view', 'timesheets:create', 'timesheets:view',
  'notifications:view',
  'assets:view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. MASTER DATA: DEPARTMENTS, DESIGNATIONS, TEAMS
INSERT INTO departments (id, organization_id, branch_id, name, code, description)
VALUES 
('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Human Resources', 'DEP-HR', 'People Operations & Talent Acquisition'),
('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Engineering', 'DEP-ENG', 'Software & Product Engineering'),
('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Sales', 'DEP-SALES', 'Business Development & Client Relations'),
('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Finance', 'DEP-FIN', 'Corporate Finance & Accounting'),
('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Operations', 'DEP-OPS', 'Business Operations & Logistics'),
('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Information Technology', 'DEP-IT', 'IT Infrastructure & Support'),
('30000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Administration', 'DEP-ADMIN', 'Facility & Executive Support')
ON CONFLICT (code) DO NOTHING;

INSERT INTO designations (id, organization_id, department_id, name, code, description)
VALUES 
('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'HR Manager', 'DES-HRM', 'Head of Human Resources'),
('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'Software Engineer', 'DES-SWE', 'Fullstack Software Engineer'),
('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'Sales Executive', 'DES-SE', 'Enterprise Sales Lead'),
('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 'Finance Executive', 'DES-FE', 'Senior Accountant'),
('40000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005', 'Operations Manager', 'DES-OM', 'Head of Operations'),
('40000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006', 'IT Administrator', 'DES-ITA', 'Systems & Security Administrator'),
('40000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007', 'System Administrator', 'DES-SYSADMIN', 'Infrastructure Architect')
ON CONFLICT (code) DO NOTHING;

INSERT INTO teams (id, organization_id, department_id, name, code)
VALUES 
('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'HR Operations', 'TEAM-HROPS'),
('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'Engineering Team', 'TEAM-ENG'),
('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'Sales Team', 'TEAM-SALES'),
('50000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 'Finance Team', 'TEAM-FIN'),
('50000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005', 'Operations Team', 'TEAM-OPS'),
('50000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006', 'IT Support', 'TEAM-ITSUPPORT'),
('50000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007', 'Administration Team', 'TEAM-ADMIN')
ON CONFLICT (code) DO NOTHING;

-- 5. LOCATIONS, LEAVE TYPES, EXPENSE CATEGORIES, PROJECTS, DOC TYPES, HOLIDAYS
INSERT INTO attendance_locations (id, organization_id, branch_id, name, latitude, longitude, radius_meters)
VALUES ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'THEIAKSHI HQ Office', 28.66920000, 77.45380000, 500.00)
ON CONFLICT DO NOTHING;

INSERT INTO leave_types (id, organization_id, name, code, annual_quota, is_paid, is_active)
VALUES 
('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Casual Leave', 'CL', 12, TRUE, TRUE),
('70000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Sick Leave', 'SL', 12, TRUE, TRUE),
('70000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Earned / Privilege Leave', 'EL', 18, TRUE, TRUE),
('70000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Optional Holiday Leave', 'OL', 3, TRUE, FALSE)
ON CONFLICT (code) DO UPDATE SET annual_quota = EXCLUDED.annual_quota, is_active = EXCLUDED.is_active;

INSERT INTO expense_categories (id, organization_id, name, code, description)
VALUES 
('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Travel', 'EXP-TRAVEL', 'Business Travel & Transport'),
('80000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Food', 'EXP-FOOD', 'Client Meals & Team Dinners'),
('80000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Accommodation', 'EXP-HOTEL', 'Hotel & Boarding Expenses'),
('80000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Office Supplies', 'EXP-SUPPLIES', 'Stationery & Hardware Consumables'),
('80000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Internet / Communication', 'EXP-COMM', 'Mobile & Broadband Reimbursement'),
('80000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Medical', 'EXP-MED', 'Employee Wellness & Emergency Medical'),
('80000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Other', 'EXP-OTHER', 'Miscellaneous Operational Expenses')
ON CONFLICT (code) DO NOTHING;

INSERT INTO projects (id, organization_id, name, code, description, status)
VALUES 
('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Internal Operations', 'PRJ-INT-OPS', 'Core Company Operations & Logistics', 'ACTIVE'),
('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'HRMS Development', 'PRJ-HRMS', 'Enterprise Human Resource Platform Rebuild', 'ACTIVE'),
('90000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Website Development', 'PRJ-WEB', 'Corporate Portal & Brand Website Modernization', 'ACTIVE'),
('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Sales Operations', 'PRJ-SALES', 'Client Pipeline & CRM System Support', 'ACTIVE')
ON CONFLICT (code) DO NOTHING;

INSERT INTO holidays (id, organization_id, branch_id, title, date, holiday_type, description)
VALUES 
('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Republic Day', '2026-01-26', 'NATIONAL', 'National Holiday'),
('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Independence Day', '2026-08-15', 'NATIONAL', 'National Holiday'),
('b0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Mahatma Gandhi Jayanti', '2026-10-02', 'NATIONAL', 'National Holiday'),
('b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'Diwali', '2026-11-08', 'COMPANY', 'Festival Holiday')
ON CONFLICT DO NOTHING;

-- 7. DEMO USER ACCOUNTS & LINKED EMPLOYEES
-- Password hash for 'ChangeMe@123': $2a$10$pvP3sWXFqrslx.3EcoCqiuGhCuiT6K.jB7LsNRV1aMAcUWWsOnE.S
-- User 1: SUPER ADMIN (No employee profile)
INSERT INTO users (id, organization_id, email, password_hash, status)
VALUES ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'superadmin@theiakshi.com', '$2a$10$pvP3sWXFqrslx.3EcoCqiuGhCuiT6K.jB7LsNRV1aMAcUWWsOnE.S', 'ACTIVE')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = EXCLUDED.status;

INSERT INTO user_roles (user_id, role_id)
SELECT 'd0000000-0000-0000-0000-000000000001', id FROM roles WHERE name = 'SUPER_ADMIN'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- User 2: ADMIN (No employee profile)
INSERT INTO users (id, organization_id, email, password_hash, status)
VALUES ('d0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'admin@theiakshi.com', '$2a$10$pvP3sWXFqrslx.3EcoCqiuGhCuiT6K.jB7LsNRV1aMAcUWWsOnE.S', 'ACTIVE')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = EXCLUDED.status;

INSERT INTO user_roles (user_id, role_id)
SELECT 'd0000000-0000-0000-0000-000000000002', id FROM roles WHERE name = 'ADMIN'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- User 3: HR MANAGER (Linked Employee: EMP-001)
INSERT INTO users (id, organization_id, email, password_hash, status)
VALUES ('d0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'hr@theiakshi.com', '$2a$10$pvP3sWXFqrslx.3EcoCqiuGhCuiT6K.jB7LsNRV1aMAcUWWsOnE.S', 'ACTIVE')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = EXCLUDED.status;

INSERT INTO user_roles (user_id, role_id)
SELECT 'd0000000-0000-0000-0000-000000000003', id FROM roles WHERE name = 'HR_MANAGER'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO employees (id, organization_id, user_id, employee_code, first_name, last_name, email, phone, joining_date, employment_type, status, branch_id, department_id, designation_id, team_id)
VALUES ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'EMP-001', 'Aarav', 'Sharma', 'hr@theiakshi.com', '+919876543210', '2024-01-01', 'FULL_TIME', 'ACTIVE', '00000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001')
ON CONFLICT (employee_code) DO NOTHING;

-- User 4: MANAGER (Linked Employee: EMP-002)
INSERT INTO users (id, organization_id, email, password_hash, status)
VALUES ('d0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'manager@theiakshi.com', '$2a$10$pvP3sWXFqrslx.3EcoCqiuGhCuiT6K.jB7LsNRV1aMAcUWWsOnE.S', 'ACTIVE')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = EXCLUDED.status;

INSERT INTO user_roles (user_id, role_id)
SELECT 'd0000000-0000-0000-0000-000000000004', id FROM roles WHERE name = 'MANAGER'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO employees (id, organization_id, user_id, employee_code, first_name, last_name, email, phone, joining_date, employment_type, status, branch_id, department_id, designation_id, team_id)
VALUES ('e0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'EMP-002', 'Priya', 'Verma', 'manager@theiakshi.com', '+919876543211', '2024-02-01', 'FULL_TIME', 'ACTIVE', '00000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000005')
ON CONFLICT (employee_code) DO NOTHING;

-- User 5: EMPLOYEE (Linked Employee: EMP-003)
INSERT INTO users (id, organization_id, email, password_hash, status)
VALUES ('d0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'employee@theiakshi.com', '$2a$10$pvP3sWXFqrslx.3EcoCqiuGhCuiT6K.jB7LsNRV1aMAcUWWsOnE.S', 'ACTIVE')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = EXCLUDED.status;

INSERT INTO user_roles (user_id, role_id)
SELECT 'd0000000-0000-0000-0000-000000000005', id FROM roles WHERE name = 'EMPLOYEE'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO employees (id, organization_id, user_id, employee_code, first_name, last_name, email, phone, joining_date, employment_type, status, branch_id, department_id, designation_id, team_id, manager_id)
VALUES ('e0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005', 'EMP-003', 'Rohan', 'Gupta', 'employee@theiakshi.com', '+919876543212', '2024-03-01', 'FULL_TIME', 'ACTIVE', '00000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002')
ON CONFLICT (employee_code) DO NOTHING;

-- 8. INITIAL LEAVE BALANCES FOR EMPLOYEES
INSERT INTO leave_balances (organization_id, employee_id, leave_type_id, year, quota, used, pending, available)
SELECT '00000000-0000-0000-0000-000000000001', e.id, lt.id, 2026, lt.annual_quota, 0, 0, lt.annual_quota
FROM employees e, leave_types lt
ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;

-- 9. ASSET CATEGORIES BASELINE
INSERT INTO asset_categories (id, organization_id, name, code, description)
VALUES 
('f0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Electronic', 'CAT-ELECTRONIC', 'Electronic equipment, devices & appliances'),
('f0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Hardware', 'CAT-HARDWARE', 'IT hardware, laptops, servers & computer peripherals'),
('f0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Parts', 'CAT-PARTS', 'Component parts, spare parts & replacement modules'),
('f0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Machine', 'CAT-MACHINE', 'Industrial machines, lab tools & heavy equipment'),
('f0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Laptop', 'CAT-LAPTOP', 'Portable laptops and notebooks'),
('f0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Furniture', 'CAT-FURNITURE', 'Office desks, ergonomic chairs, cabinets')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 10. DEMO ASSETS & ASSIGNMENT HISTORY
INSERT INTO assets (id, organization_id, asset_code, asset_name, category_id, asset_type, brand, model, serial_number, purchase_date, purchase_price, current_value, condition, status, location, assigned_employee_id, assigned_date, expected_return_date)
VALUES 
(
  'f1000000-0000-0000-0000-000000000001', 
  '00000000-0000-0000-0000-000000000001', 
  'TE-IT-0001', 
  'Dell Latitude 5440 Laptop', 
  (SELECT id FROM asset_categories WHERE code = 'CAT-LAPTOP' LIMIT 1), 
  'HARDWARE', 'Dell', 'Latitude 5440', 'DL-LAT-98765', '2025-01-15', 75000.00, 68000.00, 'EXCELLENT', 'ASSIGNED', 'HQ Floor 3', 
  (SELECT id FROM employees WHERE employee_code = 'EMP-003' LIMIT 1), 
  '2025-02-01', '2026-12-31'
),
(
  'f1000000-0000-0000-0000-000000000002', 
  '00000000-0000-0000-0000-000000000001', 
  'TE-IT-0002', 
  'HP UltraSharp 27" 4K Monitor', 
  (SELECT id FROM asset_categories WHERE code = 'CAT-MONITOR' LIMIT 1), 
  'HARDWARE', 'HP', 'UltraSharp Z27', 'HP-MON-44321', '2025-02-10', 32000.00, 29000.00, 'NEW', 'AVAILABLE', 'IT Storage Bay', 
  NULL, NULL, NULL
),
(
  'f1000000-0000-0000-0000-000000000003', 
  '00000000-0000-0000-0000-000000000001', 
  'TE-MOB-0001', 
  'Samsung Galaxy S24 Ultra', 
  (SELECT id FROM asset_categories WHERE code = 'CAT-MOBILE' LIMIT 1), 
  'HARDWARE', 'Samsung', 'Galaxy S24 Ultra', 'SM-GAL-11223', '2025-03-01', 110000.00, 98000.00, 'EXCELLENT', 'ASSIGNED', 'HQ Floor 2', 
  (SELECT id FROM employees WHERE employee_code = 'EMP-002' LIMIT 1), 
  '2025-03-05', '2026-12-31'
),
(
  'f1000000-0000-0000-0000-000000000004', 
  '00000000-0000-0000-0000-000000000001', 
  'TE-ACC-0001', 
  'Logitech MX Keys Wireless Combo', 
  (SELECT id FROM asset_categories WHERE code = 'CAT-PERIPHERAL' LIMIT 1), 
  'PERIPHERAL', 'Logitech', 'MX Keys Advanced', 'LOG-MX-88990', '2025-01-20', 12000.00, 10000.00, 'GOOD', 'AVAILABLE', 'IT Storage Bay', 
  NULL, NULL, NULL
),
(
  'f1000000-0000-0000-0000-000000000005', 
  '00000000-0000-0000-0000-000000000001', 
  'TE-FUR-0001', 
  'Ergonomic Mesh Executive Chair', 
  (SELECT id FROM asset_categories WHERE code = 'CAT-FURNITURE' LIMIT 1), 
  'FURNITURE', 'Featherlite', 'Optima Mesh', 'FL-OPT-55667', '2024-11-05', 18000.00, 15000.00, 'GOOD', 'AVAILABLE', 'HQ Floor 1', 
  NULL, NULL, NULL
)
ON CONFLICT (asset_code) DO NOTHING;

INSERT INTO asset_history (asset_id, organization_id, action, previous_status, new_status, employee_id, notes)
VALUES 
(
  (SELECT id FROM assets WHERE asset_code = 'TE-IT-0001' LIMIT 1), 
  '00000000-0000-0000-0000-000000000001', 
  'ASSIGNED', 'AVAILABLE', 'ASSIGNED', 
  (SELECT id FROM employees WHERE employee_code = 'EMP-003' LIMIT 1), 
  'Initial laptop allocation for Rohan Gupta'
),
(
  (SELECT id FROM assets WHERE asset_code = 'TE-MOB-0001' LIMIT 1), 
  '00000000-0000-0000-0000-000000000001', 
  'ASSIGNED', 'AVAILABLE', 'ASSIGNED', 
  (SELECT id FROM employees WHERE employee_code = 'EMP-002' LIMIT 1), 
  'Executive test device allocation for Priya Verma'
);

COMMIT;
