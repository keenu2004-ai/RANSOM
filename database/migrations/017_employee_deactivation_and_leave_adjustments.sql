-- ============================================================
-- MIGRATION 017: EMPLOYEE LEAVE ADJUSTMENTS & LEAVE REVOCATION
-- ============================================================

CREATE TABLE IF NOT EXISTS employee_leave_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    period_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    period_month INT,
    adjustment_type VARCHAR(50) NOT NULL DEFAULT 'INCREMENT' CHECK (adjustment_type IN ('INCREMENT', 'DECREMENT', 'OVERRIDE')),
    adjustment_value NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    final_entitlement NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    reason TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emp_leave_adj ON employee_leave_adjustments(organization_id, employee_id, leave_type_id, period_year);

-- Ensure leave_requests status includes CANCELLED and CANCELLATION_REQUESTED
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_status_check;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'CANCELLATION_REQUESTED'));
