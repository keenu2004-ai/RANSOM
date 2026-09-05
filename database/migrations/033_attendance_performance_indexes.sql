-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — MIGRATION 033: ATTENDANCE PERFORMANCE INDEXES
-- Purpose: Optimized composite indexes for high-volume workforce aggregation,
-- single-employee chronological pagination, and date-range resolutions.
-- ============================================================

-- 1. Composite index for single-employee date range filtering and latest-first chronological ordering
CREATE INDEX IF NOT EXISTS idx_attendance_org_emp_date_desc 
ON attendance (organization_id, employee_id, date DESC, check_in DESC);

-- 2. Composite index for organization-wide date range filtering and aggregation
CREATE INDEX IF NOT EXISTS idx_attendance_org_date_desc 
ON attendance (organization_id, date DESC);

-- 3. Composite index for leave requests by date range and status for attendance day resolution
CREATE INDEX IF NOT EXISTS idx_leave_requests_org_emp_dates_status 
ON leave_requests (organization_id, employee_id, status, start_date, end_date);

-- 4. Composite index for holiday lookups by organization and date
CREATE INDEX IF NOT EXISTS idx_holidays_org_date 
ON holidays (organization_id, date);

