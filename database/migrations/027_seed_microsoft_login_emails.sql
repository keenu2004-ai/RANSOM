-- Migration: 027_seed_microsoft_login_emails.sql
-- Description: Populate explicit Microsoft Entra login email/UPN mappings targeting canonical user emails without altering users.email values

BEGIN;

-- 1. office@theiakshi.com -> Sumit Kumar (canonical: sumit.kumar@theiakshi.com)
UPDATE users 
SET microsoft_login_email = 'office@theiakshi.com', updated_at = CURRENT_TIMESTAMP
WHERE LOWER(email) = 'sumit.kumar@theiakshi.com'
  AND (microsoft_login_email IS NULL OR microsoft_login_email != 'office@theiakshi.com');

-- 2. chennai@theiakshi.com -> Prathaph S (canonical: prathaph.s@theiakshi.com)
UPDATE users 
SET microsoft_login_email = 'chennai@theiakshi.com', updated_at = CURRENT_TIMESTAMP
WHERE LOWER(email) = 'prathaph.s@theiakshi.com'
  AND (microsoft_login_email IS NULL OR microsoft_login_email != 'chennai@theiakshi.com');

-- 3. north@theiakshi.com -> Priyankit Kataria (canonical: priyankit.kataria@theiakshi.com)
UPDATE users 
SET microsoft_login_email = 'north@theiakshi.com', updated_at = CURRENT_TIMESTAMP
WHERE LOWER(email) = 'priyankit.kataria@theiakshi.com'
  AND (microsoft_login_email IS NULL OR microsoft_login_email != 'north@theiakshi.com');

-- 4. vaibhav@theiakshi.com -> Vaibhav Rajput (canonical: vaibhav.rajput@theiakshi.com)
UPDATE users 
SET microsoft_login_email = 'vaibhav@theiakshi.com', updated_at = CURRENT_TIMESTAMP
WHERE LOWER(email) = 'vaibhav.rajput@theiakshi.com'
  AND (microsoft_login_email IS NULL OR microsoft_login_email != 'vaibhav@theiakshi.com');

-- 5. info@theiakshi.com -> Info HR Team (canonical: info@theiakshi.com)
UPDATE users 
SET microsoft_login_email = 'info@theiakshi.com', updated_at = CURRENT_TIMESTAMP
WHERE LOWER(email) = 'info@theiakshi.com'
  AND (microsoft_login_email IS NULL OR microsoft_login_email != 'info@theiakshi.com');

-- 6. admin@theiakshi.onmicrosoft.com -> Vinay Kumar Tanwar (canonical: admin@theiakshi.com)
UPDATE users 
SET microsoft_login_email = 'admin@theiakshi.onmicrosoft.com', updated_at = CURRENT_TIMESTAMP
WHERE LOWER(email) = 'admin@theiakshi.com'
  AND (microsoft_login_email IS NULL OR microsoft_login_email != 'admin@theiakshi.onmicrosoft.com');

-- 7. vinay@theiakshi.com -> Vinay Staff (canonical: vinay@theiakshi.com)
UPDATE users 
SET microsoft_login_email = 'vinay@theiakshi.com', updated_at = CURRENT_TIMESTAMP
WHERE LOWER(email) = 'vinay@theiakshi.com'
  AND (microsoft_login_email IS NULL OR microsoft_login_email != 'vinay@theiakshi.com');

COMMIT;
