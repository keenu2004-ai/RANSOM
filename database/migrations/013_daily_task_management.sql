-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — MIGRATION 013: DAILY TASK MANAGEMENT
-- ============================================================

-- 1. Make project_id optional for tasks going forward
ALTER TABLE timesheets ALTER COLUMN project_id DROP NOT NULL;

-- 2. Add title and created_by columns if not exists
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 3. Drop restrictive status check constraint if it exists to allow PLANNED, IN_PROGRESS, COMPLETED, SUBMITTED, APPROVED, REJECTED
ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_status_check;
ALTER TABLE timesheets ADD CONSTRAINT timesheets_status_check CHECK (
  status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'SUBMITTED', 'APPROVED', 'REJECTED')
);

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_timesheets_assigned_date ON timesheets(organization_id, employee_id, date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_timesheets_created_by ON timesheets(organization_id, created_by) WHERE deleted_at IS NULL;
