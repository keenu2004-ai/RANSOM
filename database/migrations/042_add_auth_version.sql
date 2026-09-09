-- Migration 042: Add auth_version to users table
-- Required for immediate session invalidation

BEGIN;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 1;

COMMIT;
