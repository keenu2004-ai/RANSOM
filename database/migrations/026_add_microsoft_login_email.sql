-- Migration: 026_add_microsoft_login_email.sql
-- Description: Add explicit Microsoft Entra login email/UPN field to users table without modifying canonical users.email

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS microsoft_login_email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_users_microsoft_login_email_lower ON users (LOWER(microsoft_login_email)) WHERE microsoft_login_email IS NOT NULL;

COMMIT;
