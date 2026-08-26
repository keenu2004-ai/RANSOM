-- Migration: 025_microsoft_entra_authentication_and_rbac.sql
-- Description: Add Microsoft Entra identity fields and consolidate RBAC to 3 canonical roles (SUPER_ADMIN, HR_MANAGER, EMPLOYEE)

BEGIN;

-- 1. Add Microsoft Identity Columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS microsoft_oid VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS microsoft_tid VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Make password_hash nullable for Microsoft SSO users
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Create Unique Index on microsoft_oid if not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_microsoft_oid ON users (microsoft_oid) WHERE microsoft_oid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

-- 2. Consolidate System Roles in roles table
INSERT INTO roles (id, organization_id, name, description, is_system_role)
VALUES 
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'SUPER_ADMIN', 'Super Administrator with full system authority', TRUE),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'HR_MANAGER', 'HR Manager with operational management authority', TRUE),
('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'EMPLOYEE', 'Employee Self-Service user', TRUE)
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- 3. Remap existing user_roles to canonical roles
-- Map legacy ADMIN role users -> SUPER_ADMIN
UPDATE user_roles ur
SET role_id = (SELECT id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1)
FROM roles r
WHERE ur.role_id = r.id AND r.name IN ('ADMIN', 'ADMINISTRATOR');

-- Map legacy MANAGER, FINANCE, HR_ADMIN, HR_EXECUTIVE role users -> HR_MANAGER
UPDATE user_roles ur
SET role_id = (SELECT id FROM roles WHERE name = 'HR_MANAGER' LIMIT 1)
FROM roles r
WHERE ur.role_id = r.id AND r.name IN ('MANAGER', 'FINANCE', 'HR_ADMIN', 'HR_EXECUTIVE', 'OPERATIONAL_MANAGER');

COMMIT;
