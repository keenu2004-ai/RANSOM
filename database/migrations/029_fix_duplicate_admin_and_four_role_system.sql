-- Migration: 029_fix_duplicate_admin_and_four_role_system.sql
-- Description: Safe, idempotent system role resolution, identity cleanup & user_role assignment
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

-- 3. Strictly Deduplicate ONLY User Records whose CANONICAL EMAIL is 'admin@theiakshi.onmicrosoft.com'
DO $$
DECLARE
    primary_id UUID;
    dup_record RECORD;
    super_admin_role_id UUID;
    org_id UUID;
BEGIN
    SELECT id INTO super_admin_role_id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1;

    -- Find primary user record for admin@theiakshi.onmicrosoft.com based STRICTLY on canonical email
    SELECT id INTO primary_id
    FROM users
    WHERE LOWER(TRIM(email)) = 'admin@theiakshi.onmicrosoft.com'
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    IF primary_id IS NOT NULL THEN
        -- Safely reassign relationships and clean up duplicate records whose canonical email is admin@theiakshi.onmicrosoft.com
        FOR dup_record IN 
            SELECT id FROM users 
            WHERE LOWER(TRIM(email)) = 'admin@theiakshi.onmicrosoft.com'
              AND id != primary_id
        LOOP
            -- Reassign duplicate user's roles to primary_id safely using ON CONFLICT DO NOTHING
            INSERT INTO user_roles (user_id, role_id)
            SELECT primary_id, role_id
            FROM user_roles
            WHERE user_id = dup_record.id
            ON CONFLICT (user_id, role_id) DO NOTHING;

            -- Delete user_roles for duplicate
            DELETE FROM user_roles WHERE user_id = dup_record.id;
            
            -- Reassign audit_logs foreign key
            UPDATE audit_logs SET user_id = primary_id WHERE user_id = dup_record.id;

            -- Unlink user_id reference from employees table for duplicate admin account (Management-only admin HAS NO EMPLOYEE PROFILE)
            -- This preserves the employee record intact (employee code, designation, department, UUID) while setting user_id = NULL
            UPDATE employees SET user_id = NULL WHERE user_id = dup_record.id;

            -- Delete the duplicate user row
            DELETE FROM users WHERE id = dup_record.id;
        END LOOP;

        -- Ensure primary management admin user has NO employee link (Management-only admin HAS NO EMPLOYEE PROFILE)
        UPDATE employees SET user_id = NULL WHERE user_id = primary_id;

        -- Update primary user record with exact email, login email, and status
        UPDATE users
        SET email = 'admin@theiakshi.onmicrosoft.com',
            microsoft_login_email = 'admin@theiakshi.onmicrosoft.com',
            status = 'ACTIVE',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = primary_id;

        -- Ensure primary user has SUPER_ADMIN role assigned safely
        IF super_admin_role_id IS NOT NULL THEN
            INSERT INTO user_roles (user_id, role_id)
            VALUES (primary_id, super_admin_role_id)
            ON CONFLICT (user_id, role_id) DO NOTHING;
        END IF;
    ELSE
        -- Insert management-only account dynamically if missing (No hardcoded users.id)
        SELECT id INTO org_id FROM organizations LIMIT 1;
        IF org_id IS NULL THEN org_id := '00000000-0000-0000-0000-000000000001'; END IF;

        INSERT INTO users (organization_id, email, microsoft_login_email, status)
        VALUES (org_id, 'admin@theiakshi.onmicrosoft.com', 'admin@theiakshi.onmicrosoft.com', 'ACTIVE')
        ON CONFLICT (email) DO UPDATE SET microsoft_login_email = EXCLUDED.microsoft_login_email, status = 'ACTIVE'
        RETURNING id INTO primary_id;

        IF primary_id IS NULL THEN
            SELECT id INTO primary_id FROM users WHERE LOWER(TRIM(email)) = 'admin@theiakshi.onmicrosoft.com' LIMIT 1;
        END IF;

        IF primary_id IS NOT NULL AND super_admin_role_id IS NOT NULL THEN
            INSERT INTO user_roles (user_id, role_id)
            VALUES (primary_id, super_admin_role_id)
            ON CONFLICT (user_id, role_id) DO NOTHING;
        END IF;
    END IF;
END $$;

-- 4. Ensure vinay@theiakshi.com has SUPER_ADMIN role as a completely separate account without altering its identity, employee profile, or login email
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
