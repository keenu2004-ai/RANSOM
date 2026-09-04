-- ============================================================
-- MIGRATION 031: HOLIDAY REGIONAL ASSIGNMENTS & REGION SUPPORT
-- Adds region column to employees, assignment_scope & region to holidays,
-- and holiday_employee_assignments junction table for multi-select.
-- ============================================================

-- 1. Add region column to employees table if not present (nullable, no default assumptions)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS region VARCHAR(30) NULL CHECK (region IN ('NORTH', 'SOUTH'));

-- 2. Add assignment_scope and region columns to holidays table
ALTER TABLE holidays ADD COLUMN IF NOT EXISTS assignment_scope VARCHAR(30) NOT NULL DEFAULT 'ALL' CHECK (assignment_scope IN ('ALL', 'REGION', 'EMPLOYEES'));
ALTER TABLE holidays ADD COLUMN IF NOT EXISTS region VARCHAR(30) NULL CHECK (region IN ('NORTH', 'SOUTH'));

-- 3. Create holiday_employee_assignments junction table
CREATE TABLE IF NOT EXISTS holiday_employee_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    holiday_id UUID NOT NULL REFERENCES holidays(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_holiday_employee UNIQUE (holiday_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_holiday_emp_assign_holiday ON holiday_employee_assignments(holiday_id);
CREATE INDEX IF NOT EXISTS idx_holiday_emp_assign_emp ON holiday_employee_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_region ON employees(region);
