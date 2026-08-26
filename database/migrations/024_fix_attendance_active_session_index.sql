-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — MIGRATION 024: ATTENDANCE ACTIVE SESSION INDEX CORRECTION
-- ============================================================

-- Re-create idx_attendance_active_session index to enforce at most ONE active/current open session
-- per employee (check_out IS NULL AND (session_state IS NULL OR session_state = 'ACTIVE')).
-- Historical ROLLOVER_TERMINATED sessions (where check_out remains NULL) do not conflict.

DROP INDEX IF EXISTS idx_attendance_active_session;

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_active_session 
ON attendance (organization_id, employee_id) 
WHERE check_out IS NULL AND (session_state IS NULL OR session_state = 'ACTIVE');
