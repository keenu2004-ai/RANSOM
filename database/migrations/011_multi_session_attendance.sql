-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — MIGRATION 011: MULTI-SESSION ATTENDANCE
-- ============================================================

-- 1. Remove single-session per day unique constraint if present
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS uk_employee_attendance_date;

-- 2. Add GPS accuracy tracking columns
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_in_accuracy NUMERIC(8, 2);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_out_accuracy NUMERIC(8, 2);

-- 3. Audit-Safe Data Remediation: Resolve legacy duplicate open sessions (check_out IS NULL)
-- Keeps the newest active session (highest check_in) open.
-- For older duplicate open sessions: sets check_out = check_in (working_hours = 0.00) without fabricating false work hours.
-- Inserts audit log entries for every remediated duplicate record.
WITH active_ranks AS (
  SELECT id, organization_id, employee_id, check_in,
         ROW_NUMBER() OVER (
           PARTITION BY organization_id, employee_id 
           ORDER BY check_in DESC, created_at DESC
         ) as rank
  FROM attendance
  WHERE check_out IS NULL
),
remediated_rows AS (
  UPDATE attendance
  SET check_out = check_in,
      working_hours = 0.00,
      notes = COALESCE(notes, '') || ' [System auto-closed duplicate open session during migration 011]',
      updated_at = CURRENT_TIMESTAMP
  WHERE id IN (
    SELECT id FROM active_ranks WHERE rank > 1
  )
  RETURNING id, organization_id, employee_id, check_in
)
INSERT INTO audit_logs (organization_id, user_id, action, module, entity_name, entity_id, new_values)
SELECT 
  organization_id,
  '00000000-0000-0000-0000-000000000000',
  'ATTENDANCE_DUPLICATE_AUTO_CLOSED',
  'attendance',
  'AttendanceSession',
  id,
  json_build_object(
    'reason', 'Duplicate open session auto-closed during migration 011',
    'check_in', check_in,
    'check_out', check_in,
    'working_hours', 0.00
  )::text
FROM remediated_rows;

-- 4. Enforce maximum of ONE active open session (check_out IS NULL) per employee
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_active_session 
ON attendance (organization_id, employee_id) 
WHERE check_out IS NULL;
