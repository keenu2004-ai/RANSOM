-- Migration: 029_fix_duplicate_admin_and_four_role_system.sql
-- Description: Safe, idempotent system role resolution & identity cleanup
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

-- Map legacy ADMIN / ADMINISTRATOR -> SUPER_ADMIN
UPDATE user_roles ur
SET role_id = (SELECT id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1)
FROM roles r
WHERE ur.role_id = r.id AND r.name IN ('ADMIN', 'ADMINISTRATOR');

-- Map legacy TEAM_LEAD -> OPERATIONAL_MANAGER if any exist
UPDATE user_roles ur
SET role_id = (SELECT id FROM roles WHERE name = 'OPERATIONAL_MANAGER' LIMIT 1)
FROM roles r
WHERE ur.role_id = r.id AND r.name = 'TEAM_LEAD';

-- 2. Strictly Deduplicate ONLY User Records whose CANONICAL EMAIL is 'admin@theiakshi.onmicrosoft.com'
DO $$
DECLARE
    primary_id UUID;
    dup_record RECORD;
BEGIN
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
            -- Reassign or clean user_roles
            DELETE FROM user_roles WHERE user_id = dup_record.id;
            
            -- Reassign audit_logs foreign key
            UPDATE audit_logs SET user_id = primary_id WHERE user_id = dup_record.id;

            -- Reassign or unlink employee user_id reference if any exists
            UPDATE employees SET user_id = primary_id WHERE user_id = dup_record.id;

            -- Delete the duplicate user row
            DELETE FROM users WHERE id = dup_record.id;
        END LOOP;

        -- Update primary user record with exact email, login email, and status
        UPDATE users
        SET email = 'admin@theiakshi.onmicrosoft.com',
            microsoft_login_email = 'admin@theiakshi.onmicrosoft.com',
            status = 'ACTIVE',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = primary_id;

        -- Ensure primary user has SUPER_ADMIN role assigned
        INSERT INTO user_roles (user_id, role_id)
        VALUES (primary_id, (SELECT id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1))
        ON CONFLICT (user_id, role_id) DO NOTHING;
    ELSE
        -- Insert management-only account if missing
        INSERT INTO users (id, organization_id, email, microsoft_login_email, status)
        VALUES ('d0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'admin@theiakshi.onmicrosoft.com', 'admin@theiakshi.onmicrosoft.com', 'ACTIVE')
        ON CONFLICT (email) DO UPDATE SET microsoft_login_email = EXCLUDED.microsoft_login_email, status = 'ACTIVE';

        INSERT INTO user_roles (user_id, role_id)
        SELECT 'd0000000-0000-0000-0000-000000000002', id FROM roles WHERE name = 'SUPER_ADMIN'
        ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;
END $$;

-- 3. Ensure vinay@theiakshi.com has SUPER_ADMIN role as a completely separate account without altering its identity or login email
DO $$
DECLARE
    vinay_user_id UUID;
BEGIN
    SELECT id INTO vinay_user_id
    FROM users
    WHERE LOWER(TRIM(email)) = 'vinay@theiakshi.com'
    LIMIT 1;

    IF vinay_user_id IS NOT NULL THEN
        INSERT INTO user_roles (user_id, role_id)
        VALUES (vinay_user_id, (SELECT id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1))
        ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;
END $$;

-- 4. Create Normalized Unique Indexes to enforce unique email identities safely
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_trimmed_lower ON users (LOWER(TRIM(email)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ms_login_email_trimmed_lower ON users (LOWER(TRIM(microsoft_login_email))) WHERE microsoft_login_email IS NOT NULL;
