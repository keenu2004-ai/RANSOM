-- Migration: 027_seed_microsoft_login_emails.sql
-- Description: Populate explicit Microsoft Entra login email/UPN mappings targeting exact HRMS user IDs without altering canonical users.email values

BEGIN;

-- 1. office@theiakshi.com -> Sumit Kumar (usr-001 / HR_MANAGER)
UPDATE users 
SET microsoft_login_email = 'office@theiakshi.com', updated_at = CURRENT_TIMESTAMP
WHERE id = 'usr-001'
  AND (microsoft_login_email IS NULL OR microsoft_login_email != 'office@theiakshi.com');

-- 2. chennai@theiakshi.com -> Prathaph S (usr-002 / EMPLOYEE)
UPDATE users 
SET microsoft_login_email = 'chennai@theiakshi.com', updated_at = CURRENT_TIMESTAMP
WHERE id = 'usr-002'
  AND (microsoft_login_email IS NULL OR microsoft_login_email != 'chennai@theiakshi.com');

-- 3. north@theiakshi.com -> Priyankit Kataria (usr-003 / EMPLOYEE)
UPDATE users 
SET microsoft_login_email = 'north@theiakshi.com', updated_at = CURRENT_TIMESTAMP
WHERE id = 'usr-003'
  AND (microsoft_login_email IS NULL OR microsoft_login_email != 'north@theiakshi.com');

-- 4. vaibhav@theiakshi.com -> Vaibhav Rajput (usr-004 / EMPLOYEE)
UPDATE users 
SET microsoft_login_email = 'vaibhav@theiakshi.com', updated_at = CURRENT_TIMESTAMP
WHERE id = 'usr-004'
  AND (microsoft_login_email IS NULL OR microsoft_login_email != 'vaibhav@theiakshi.com');

-- 5. info@theiakshi.com -> Info HR Team (usr-info-01 / HR_MANAGER)
UPDATE users 
SET microsoft_login_email = 'info@theiakshi.com', updated_at = CURRENT_TIMESTAMP
WHERE id = 'usr-info-01'
  AND (microsoft_login_email IS NULL OR microsoft_login_email != 'info@theiakshi.com');

-- 6. admin@theiakshi.onmicrosoft.com -> Vinay Kumar Tanwar (usr-admin-01 / SUPER_ADMIN)
UPDATE users 
SET microsoft_login_email = 'admin@theiakshi.onmicrosoft.com', updated_at = CURRENT_TIMESTAMP
WHERE id = 'usr-admin-01'
  AND (microsoft_login_email IS NULL OR microsoft_login_email != 'admin@theiakshi.onmicrosoft.com');

-- 7. vinay@theiakshi.com -> Vinay Staff (usr-vinay-02 / EMPLOYEE)
UPDATE users 
SET microsoft_login_email = 'vinay@theiakshi.com', updated_at = CURRENT_TIMESTAMP
WHERE id = 'usr-vinay-02'
  AND (microsoft_login_email IS NULL OR microsoft_login_email != 'vinay@theiakshi.com');

COMMIT;
