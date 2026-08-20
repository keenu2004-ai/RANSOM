-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — MIGRATION 011: MULTI-SESSION ATTENDANCE
-- ============================================================

-- 1. Remove single-session per day unique constraint if present
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS uk_employee_attendance_date;

-- 2. Add GPS accuracy tracking columns
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_in_accuracy NUMERIC(8, 2);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_out_accuracy NUMERIC(8, 2);

-- 3. Data Remediation: Safely resolve legacy duplicate open sessions (check_out IS NULL)
-- Keeps the newest active session (highest check_in) open, and safely closes older open duplicates without row deletion
WITH active_ranks AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY organization_id, employee_id 
           ORDER BY check_in DESC, created_at DESC
         ) as rank
  FROM attendance
  WHERE check_out IS NULL
)
UPDATE attendance
SET check_out = check_in + INTERVAL '8 hours',
    working_hours = 8.00,
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (
  SELECT id FROM active_ranks WHERE rank > 1
);

-- 4. Enforce maximum of ONE active open session (check_out IS NULL) per employee
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_active_session 
ON attendance (organization_id, employee_id) 
WHERE check_out IS NULL;
