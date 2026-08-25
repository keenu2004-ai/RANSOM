-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — MIGRATION 002: LEAVE POLICY UPGRADE
-- Add is_active column to leave_types & set CL/EL/SL default quotas
-- ============================================================

ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Retire 4th leave type (OL - Optional Leave) safely without deleting historical data
UPDATE leave_types SET is_active = FALSE WHERE code = 'OL';

-- Ensure 3 active leave types (CL: 6, EL: 10, SL: 6)
UPDATE leave_types SET annual_quota = 6, is_active = TRUE WHERE code = 'CL';
UPDATE leave_types SET annual_quota = 10, is_active = TRUE WHERE code IN ('EL', 'PL');
UPDATE leave_types SET annual_quota = 6, is_active = TRUE WHERE code = 'SL';

-- Indexes for performance on leave requests and balances
CREATE INDEX IF NOT EXISTS idx_leave_requests_emp_dates ON leave_requests (employee_id, status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_balances_emp_type_year ON leave_balances (employee_id, leave_type_id, year);
CREATE INDEX IF NOT EXISTS idx_timesheets_emp_date ON timesheets (employee_id, date);
