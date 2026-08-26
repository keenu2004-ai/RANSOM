-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — MIGRATION 023: ATTENDANCE REGULARIZATION & ROLLOVER
-- ============================================================

-- 1. Extend attendance table for rollover session state & audit details
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS system_terminated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS termination_reason TEXT,
  ADD COLUMN IF NOT EXISTS session_state VARCHAR(50) DEFAULT 'COMPLETED';

-- Drop restrictive check constraints on attendance status if present
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;

-- 2. Extend attendance_regularizations table for no-check-in dates & forgotten checkouts
ALTER TABLE attendance_regularizations
  ADD COLUMN IF NOT EXISTS attendance_session_id UUID REFERENCES attendance(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attendance_type VARCHAR(50) DEFAULT 'PRESENT',
  ADD COLUMN IF NOT EXISTS original_in_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_out_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS system_terminated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES employees(id) ON DELETE SET NULL;

-- Drop restrictive check constraints on attendance_regularizations status if present
ALTER TABLE attendance_regularizations DROP CONSTRAINT IF EXISTS attendance_regularizations_status_check;

-- Create index for quick lookup of pending regularization requests by date
CREATE INDEX IF NOT EXISTS idx_att_reg_emp_date_status ON attendance_regularizations(organization_id, employee_id, attendance_date, status);
