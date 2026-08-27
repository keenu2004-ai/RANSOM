-- Migration: 028_seed_correct_microsoft_login_emails.sql
-- Description: Populate explicit Microsoft Entra login email/UPN mappings targeting exact production PostgreSQL UUIDs without altering canonical users.email values

BEGIN;

-- 1. office@theiakshi.com -> Sumit Kumar (d0000000-0000-0000-0000-000000000003 / HR_MANAGER)
UPDATE users 
SET microsoft_login_email = 'office@theiakshi.com', updated_at = CURRENT_TIMESTAMP
WHERE id = 'd0000000-0000-0000-0000-000000000003'
  AND (microsoft_login_email IS NULL OR microsoft_login_email != 'office@theiakshi.com');

-- 2. chennai@theiakshi.com -> Prathaph S (d0000000-0000-0000-0000-000000000004 / EMPLOYEE)
UPDATE users 
SET microsoft_login_email = 'chennai@theiakshi.com', updated_at = CURRENT_TIMESTAMP
WHERE id = 'd0000000-0000-0000-0000-000000000004'
  AND (microsoft_login_email IS NULL OR microsoft_login_email != 'chennai@theiakshi.com');

-- 3. vaibhav@theiakshi.com -> Vaibhav Rajput (d0000000-0000-0000-0000-000000000005 / EMPLOYEE)
UPDATE users 
SET microsoft_login_email = 'vaibhav@theiakshi.com', updated_at = CURRENT_TIMESTAMP
WHERE id = 'd0000000-0000-0000-0000-000000000005'
  AND (microsoft_login_email IS NULL OR microsoft_login_email != 'vaibhav@theiakshi.com');

-- 4. admin@theiakshi.onmicrosoft.com -> Vinay Kumar Tanwar (d0000000-0000-0000-0000-000000000002 / SUPER_ADMIN)
UPDATE users 
SET microsoft_login_email = 'admin@theiakshi.onmicrosoft.com', updated_at = CURRENT_TIMESTAMP
WHERE id = 'd0000000-0000-0000-0000-000000000002'
  AND (microsoft_login_email IS NULL OR microsoft_login_email != 'admin@theiakshi.onmicrosoft.com');

COMMIT;
