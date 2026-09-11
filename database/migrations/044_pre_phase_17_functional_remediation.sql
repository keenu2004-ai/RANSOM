-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS
-- MIGRATION 044: PRE-PHASE-17 FUNCTIONAL REMEDIATION
-- Adds payment_details to expenses and inserts LWP leave type safely
-- ============================================================

-- 1. Add payment_details and payment_mode to expense tables
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_details TEXT;
ALTER TABLE trip_expenses ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50);
ALTER TABLE trip_expenses ADD COLUMN IF NOT EXISTS payment_details TEXT;

-- 2. Safely insert LWP (Leave Without Pay) for all existing organizations
-- Uses WHERE NOT EXISTS to avoid requiring a specific UNIQUE constraint on leave_types.
INSERT INTO leave_types (organization_id, name, code, description, is_active)
SELECT id, 'Leave Without Pay', 'LWP', 'Unpaid Leave', true
FROM organizations org
WHERE NOT EXISTS (
  SELECT 1 FROM leave_types lt WHERE lt.organization_id = org.id AND lt.code = 'LWP'
);
