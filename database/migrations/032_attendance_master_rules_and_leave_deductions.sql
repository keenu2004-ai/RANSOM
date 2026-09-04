-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — MIGRATION 032: ATTENDANCE MASTER RULES & AUTOMATIC LEAVE DEDUCTIONS
-- ============================================================

-- 1. Create attendance_policy_settings table for configurable master office timings
CREATE TABLE IF NOT EXISTS attendance_policy_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    office_start_time TIME NOT NULL DEFAULT '09:00:00',
    office_end_time TIME NOT NULL DEFAULT '17:00:00',
    normal_grace_end_time TIME NOT NULL DEFAULT '09:15:00',
    short_leave_end_time TIME NOT NULL DEFAULT '09:30:00',
    late_present_end_time TIME NOT NULL DEFAULT '11:00:00',
    half_day_end_time TIME NOT NULL DEFAULT '13:00:00',
    short_leave_quota_ratio NUMERIC(5, 2) NOT NULL DEFAULT 0.25, -- 2 SL = 0.5 PL, 4 SL = 1.0 PL
    half_day_quota_ratio NUMERIC(5, 2) NOT NULL DEFAULT 0.50,   -- 1 HD = 0.5 PL, 2 HD = 1.0 PL
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create attendance_automatic_leave_deductions table to track cumulative automatic attendance deductions
CREATE TABLE IF NOT EXISTS attendance_automatic_leave_deductions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    period_year INT NOT NULL,
    short_leave_count INT NOT NULL DEFAULT 0,
    half_day_count INT NOT NULL DEFAULT 0,
    total_short_leave_deduction NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    total_half_day_deduction NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    total_pl_deducted NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_att_auto_leave_deduction UNIQUE (organization_id, employee_id, leave_type_id, period_year)
);

CREATE INDEX IF NOT EXISTS idx_att_auto_leave_emp_year ON attendance_automatic_leave_deductions(organization_id, employee_id, period_year);
