-- Migration: 029_fix_duplicate_admin_and_four_role_system.sql
-- Description: Consolidate System Roles to SUPER_ADMIN, HR_MANAGER, OPERATIONAL_MANAGER, EMPLOYEE
-- Deduplicate admin@theiakshi.onmicrosoft.com records strictly without touching vinay@theiakshi.com or admin@theiakshi.com

BEGIN;

-- 1. Ensure system roles exist in roles table
INSERT INTO roles (id, organization_id, name, description, is_system_role)
VALUES 
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'SUPER_ADMIN', 'Super Administrator with full system authority', TRUE),
('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'HR_MANAGER', 'HR Manager with operational management authority', TRUE),
('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'OPERATIONAL_MANAGER', 'Operational Manager with team authority', TRUE),
('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'EMPLOYEE', 'Employee Self-Service user', TRUE)
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, is_system_role = TRUE;

-- Map legacy ADMIN -> SUPER_ADMIN
UPDATE user_roles ur
SET role_id = (SELECT id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1)
FROM roles r
WHERE ur.role_id = r.id AND r.name IN ('ADMIN', 'ADMINISTRATOR');

-- Map legacy MANAGER -> OPERATIONAL_MANAGER if distinct
UPDATE user_roles ur
SET role_id = (SELECT id FROM roles WHERE name = 'OPERATIONAL_MANAGER' LIMIT 1)
FROM roles r
WHERE ur.role_id = r.id AND r.name IN ('MANAGER', 'TEAM_LEAD');

-- 2. Deduplicate user rows matching normalized admin@theiakshi.onmicrosoft.com
-- Keep primary record (lowest ID or created_at) and merge user_roles/audit_logs if any duplicate rows exist
DO $$
DECLARE
    primary_id UUID;
    dup_record RECORD;
BEGIN
    -- Find primary user record for admin@theiakshi.onmicrosoft.com
    SELECT id INTO primary_id
    FROM users
    WHERE LOWER(TRIM(email)) = 'admin@theiakshi.onmicrosoft.com'
       OR LOWER(TRIM(microsoft_login_email)) = 'admin@theiakshi.onmicrosoft.com'
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    IF primary_id IS NOT NULL THEN
        -- Reassign or delete duplicate records
        FOR dup_record IN 
            SELECT id FROM users 
            WHERE (LOWER(TRIM(email)) = 'admin@theiakshi.onmicrosoft.com' OR LOWER(TRIM(microsoft_login_email)) = 'admin@theiakshi.onmicrosoft.com')
              AND id != primary_id
        LOOP
            -- Delete user_roles for duplicate
            DELETE FROM user_roles WHERE user_id = dup_record.id;
            -- Reassign audit logs if foreign key exists
            UPDATE audit_logs SET user_id = primary_id WHERE user_id = dup_record.id;
            -- Delete duplicate user row
            DELETE FROM users WHERE id = dup_record.id;
        END LOOP;

        -- Ensure primary account has exact email & microsoft_login_email set
        UPDATE users
        SET email = 'admin@theiakshi.onmicrosoft.com',
            microsoft_login_email = 'admin@theiakshi.onmicrosoft.com',
            status = 'ACTIVE',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = primary_id;

        -- Assign SUPER_ADMIN role to primary_id
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

-- 3. Ensure vinay@theiakshi.com has SUPER_ADMIN role as a completely separate account
DO $$
DECLARE
    vinay_user_id UUID;
BEGIN
    SELECT id INTO vinay_user_id
    FROM users
    WHERE LOWER(TRIM(email)) = 'vinay@theiakshi.com'
       OR LOWER(TRIM(microsoft_login_email)) = 'vinay@theiakshi.com'
    LIMIT 1;

    IF vinay_user_id IS NOT NULL THEN
        INSERT INTO user_roles (user_id, role_id)
        VALUES (vinay_user_id, (SELECT id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1))
        ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;
END $$;

-- 4. Create Normalized Unique Indexes to prevent future duplicate emails
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_trimmed_lower ON users (LOWER(TRIM(email)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ms_login_email_trimmed_lower ON users (LOWER(TRIM(microsoft_login_email))) WHERE microsoft_login_email IS NOT NULL;

COMMIT;
