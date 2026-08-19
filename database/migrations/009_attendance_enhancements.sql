-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — MIGRATION 009: ATTENDANCE ENHANCEMENTS
-- ============================================================

-- 1. Extend branches with GPS & location metadata
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 6) DEFAULT 12.971598,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 6) DEFAULT 77.594566,
  ADD COLUMN IF NOT EXISTS geofence_radius_meters INT DEFAULT 500,
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state VARCHAR(100);

-- 2. Extend attendance with lat/lng, breaks, and shift status flags
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS punch_in_lat NUMERIC(10, 6),
  ADD COLUMN IF NOT EXISTS punch_in_lng NUMERIC(10, 6),
  ADD COLUMN IF NOT EXISTS punch_out_lat NUMERIC(10, 6),
  ADD COLUMN IF NOT EXISTS punch_out_lng NUMERIC(10, 6),
  ADD COLUMN IF NOT EXISTS break_duration_mins INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shift_name VARCHAR(100) DEFAULT 'General Shift',
  ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_overtime BOOLEAN DEFAULT FALSE;

-- 3. Attendance Regularizations Table (UUID Primary Keys)
CREATE TABLE IF NOT EXISTS attendance_regularizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    requested_punch_in TIMESTAMPTZ,
    requested_punch_out TIMESTAMPTZ,
    reason TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approved_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_att_reg_emp_date ON attendance_regularizations(organization_id, employee_id, attendance_date);
