-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — MIGRATION 011: MULTI-SESSION ATTENDANCE
-- ============================================================

-- 1. Remove single-session per day unique constraint
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS uk_employee_attendance_date;

-- 2. Add GPS accuracy tracking columns
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_in_accuracy NUMERIC(8, 2);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_out_accuracy NUMERIC(8, 2);

-- 3. Enforce maximum of ONE active open session (check_out IS NULL) per employee
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_active_session 
ON attendance (organization_id, employee_id) 
WHERE check_out IS NULL;
