-- Migration: 029_fix_duplicate_admin_and_four_role_system.sql
-- Description: Safe, idempotent system role resolution & production admin account alignment
-- NOTE: Outer BEGIN/COMMIT transaction wrappers are omitted because database/scripts/migrate.js executes each migration within a transaction block.

-- 1. Safely Ensure Canonical 4 System Roles Exist by Name (Reusing existing rows if present without hardcoded UUID conflicts)
DO $$
DECLARE
    org_id UUID;
BEGIN
    SELECT id INTO org_id FROM organizations LIMIT 1;
    IF org_id IS NULL THEN
        org_id := '00000000-0000-0000-0000-000000000001';
    END IF;

    -- SUPER_ADMIN: Check by name first
    IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'SUPER_ADMIN') THEN
        INSERT INTO roles (organization_id, name, description, is_system_role)
        VALUES (org_id, 'SUPER_ADMIN', 'Super Administrator with full system authority', TRUE)
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, is_system_role = TRUE;
    END IF;

    -- HR_MANAGER: Check by name first
    IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'HR_MANAGER') THEN
        INSERT INTO roles (organization_id, name, description, is_system_role)
        VALUES (org_id, 'HR_MANAGER', 'HR Manager with operational management authority', TRUE)
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, is_system_role = TRUE;
    END IF;

    -- OPERATIONAL_MANAGER: Check by name first. If legacy 'MANAGER' role exists, rename it in-place preserving its UUID & foreign keys
    IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'OPERATIONAL_MANAGER') THEN
        IF EXISTS (SELECT 1 FROM roles WHERE name = 'MANAGER') THEN
            UPDATE roles SET name = 'OPERATIONAL_MANAGER', description = 'Operational Manager with team authority', is_system_role = TRUE WHERE name = 'MANAGER';
        ELSE
            INSERT INTO roles (organization_id, name, description, is_system_role)
            VALUES (org_id, 'OPERATIONAL_MANAGER', 'Operational Manager with team authority', TRUE)
            ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, is_system_role = TRUE;
        END IF;
    END IF;

    -- EMPLOYEE: Check by name first
    IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'EMPLOYEE') THEN
        INSERT INTO roles (organization_id, name, description, is_system_role)
        VALUES (org_id, 'EMPLOYEE', 'Employee Self-Service user', TRUE)
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, is_system_role = TRUE;
    END IF;
END $$;

-- 2. Safely Update user_roles mappings for legacy role names to SUPER_ADMIN / OPERATIONAL_MANAGER
-- Use ON CONFLICT (user_id, role_id) DO NOTHING to avoid uk_user_role unique constraint violation
DO $$
DECLARE
    super_admin_role_id UUID;
    op_manager_role_id UUID;
BEGIN
    SELECT id INTO super_admin_role_id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1;
    SELECT id INTO op_manager_role_id FROM roles WHERE name = 'OPERATIONAL_MANAGER' LIMIT 1;

    -- Map users with legacy ADMIN / ADMINISTRATOR role names to SUPER_ADMIN
    IF super_admin_role_id IS NOT NULL THEN
        INSERT INTO user_roles (user_id, role_id)
        SELECT DISTINCT ur.user_id, super_admin_role_id
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE r.name IN ('ADMIN', 'ADMINISTRATOR')
        ON CONFLICT (user_id, role_id) DO NOTHING;

        -- Clean up old legacy ADMIN role entries from user_roles
        DELETE FROM user_roles
        WHERE role_id IN (SELECT id FROM roles WHERE name IN ('ADMIN', 'ADMINISTRATOR'));
    END IF;

    -- Map users with legacy TEAM_LEAD role names to OPERATIONAL_MANAGER
    IF op_manager_role_id IS NOT NULL THEN
        INSERT INTO user_roles (user_id, role_id)
        SELECT DISTINCT ur.user_id, op_manager_role_id
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE r.name = 'TEAM_LEAD'
        ON CONFLICT (user_id, role_id) DO NOTHING;

        -- Clean up old legacy TEAM_LEAD role entries from user_roles
        DELETE FROM user_roles
        WHERE role_id IN (SELECT id FROM roles WHERE name = 'TEAM_LEAD');
    END IF;
END $$;

-- 3. Production Admin Account Cleanup & Management Identity Creation
-- Target 1: Create or preserve canonical management-only user with email AND microsoft_login_email equal to 'admin@theiakshi.onmicrosoft.com'
-- Target 2: Remove legacy User A (admin@theiakshi.com) after safely reassigning foreign key references (audit_logs, user_roles)
DO $$
DECLARE
    mgmt_admin_id UUID;
    legacy_admin_record RECORD;
    super_admin_role_id UUID;
    org_id UUID;
BEGIN
    SELECT id INTO super_admin_role_id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1;
    SELECT id INTO org_id FROM organizations LIMIT 1;
    IF org_id IS NULL THEN org_id := '00000000-0000-0000-0000-000000000001'; END IF;

    -- A. Locate or create canonical management-only user (email = 'admin@theiakshi.onmicrosoft.com')
    SELECT id INTO mgmt_admin_id
    FROM users
    WHERE LOWER(TRIM(email)) = 'admin@theiakshi.onmicrosoft.com'
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    IF mgmt_admin_id IS NULL THEN
        -- Insert new management-only account dynamically using PostgreSQL gen_random_uuid() / default UUID
        INSERT INTO users (organization_id, email, microsoft_login_email, status)
        VALUES (org_id, 'admin@theiakshi.onmicrosoft.com', 'admin@theiakshi.onmicrosoft.com', 'ACTIVE')
        ON CONFLICT (email) DO UPDATE SET microsoft_login_email = EXCLUDED.microsoft_login_email, status = 'ACTIVE'
        RETURNING id INTO mgmt_admin_id;

        IF mgmt_admin_id IS NULL THEN
            SELECT id INTO mgmt_admin_id FROM users WHERE LOWER(TRIM(email)) = 'admin@theiakshi.onmicrosoft.com' LIMIT 1;
        END IF;
    ELSE
        -- Ensure exact canonical values on existing management-only user
        UPDATE users
        SET email = 'admin@theiakshi.onmicrosoft.com',
            microsoft_login_email = 'admin@theiakshi.onmicrosoft.com',
            status = 'ACTIVE',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = mgmt_admin_id;
    END IF;

    -- Ensure management admin has NO employee profile link (user_id = NULL)
    IF mgmt_admin_id IS NOT NULL THEN
        UPDATE employees SET user_id = NULL WHERE user_id = mgmt_admin_id;

        IF super_admin_role_id IS NOT NULL THEN
            INSERT INTO user_roles (user_id, role_id)
            VALUES (mgmt_admin_id, super_admin_role_id)
            ON CONFLICT (user_id, role_id) DO NOTHING;
        END IF;
    END IF;

    -- B. Remove legacy admin user accounts (such as admin@theiakshi.com) that mapped microsoft_login_email = 'admin@theiakshi.onmicrosoft.com'
    -- strictly without touching vinay@theiakshi.com or any non-admin users
    FOR legacy_admin_record IN 
        SELECT id FROM users 
        WHERE (LOWER(TRIM(email)) = 'admin@theiakshi.com' OR LOWER(TRIM(microsoft_login_email)) = 'admin@theiakshi.onmicrosoft.com')
          AND id != mgmt_admin_id
          AND LOWER(TRIM(email)) != 'vinay@theiakshi.com'
    LOOP
        -- Reassign duplicate user's roles to mgmt_admin_id safely
        INSERT INTO user_roles (user_id, role_id)
        SELECT mgmt_admin_id, role_id
        FROM user_roles
        WHERE user_id = legacy_admin_record.id
        ON CONFLICT (user_id, role_id) DO NOTHING;

        -- Clean user_roles for legacy admin
        DELETE FROM user_roles WHERE user_id = legacy_admin_record.id;
        
        -- Reassign audit_logs foreign keys to mgmt_admin_id
        UPDATE audit_logs SET user_id = mgmt_admin_id WHERE user_id = legacy_admin_record.id;

        -- Unlink any employee reference safely without deleting the employee profile
        UPDATE employees SET user_id = NULL WHERE user_id = legacy_admin_record.id;

        -- Delete legacy user row
        DELETE FROM users WHERE id = legacy_admin_record.id;
    END LOOP;
END $$;

-- 4. Ensure vinay@theiakshi.com has SUPER_ADMIN role as a completely separate account without altering its identity, employee profile (EMP-007), or login email
DO $$
DECLARE
    vinay_user_id UUID;
    super_admin_role_id UUID;
BEGIN
    SELECT id INTO vinay_user_id
    FROM users
    WHERE LOWER(TRIM(email)) = 'vinay@theiakshi.com'
    LIMIT 1;

    SELECT id INTO super_admin_role_id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1;

    IF vinay_user_id IS NOT NULL AND super_admin_role_id IS NOT NULL THEN
        INSERT INTO user_roles (user_id, role_id)
        VALUES (vinay_user_id, super_admin_role_id)
        ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;
END $$;

-- 5. Create Normalized Unique Indexes to enforce unique email identities safely
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_trimmed_lower ON users (LOWER(TRIM(email)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ms_login_email_trimmed_lower ON users (LOWER(TRIM(microsoft_login_email))) WHERE microsoft_login_email IS NOT NULL;
