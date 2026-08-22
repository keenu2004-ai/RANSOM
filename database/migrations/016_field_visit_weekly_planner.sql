-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — MIGRATION 016: FIELD VISIT & WEEKLY WORK PLANNER
-- ============================================================

-- 1. Extend timesheets table with field visit & opportunity tracking columns
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255);
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS contact_details VARCHAR(255);
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS visit_location VARCHAR(255);
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS visit_type VARCHAR(100);
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS time_slot VARCHAR(100);
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS products_to_present TEXT;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS visit_objective TEXT;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS outcome_summary TEXT;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS follow_up_date DATE;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS opportunity_stage VARCHAR(100);
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS estimated_value NUMERIC(15, 2);
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'MEDIUM';

ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS rescheduled_from_task_id UUID REFERENCES timesheets(id) ON DELETE SET NULL;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS rescheduled_to_task_id UUID REFERENCES timesheets(id) ON DELETE SET NULL;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS reschedule_count INT DEFAULT 0;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS reschedule_reason TEXT;

-- 2. Update status constraint to include CANCELLED
ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_status_check;
ALTER TABLE timesheets ADD CONSTRAINT timesheets_status_check CHECK (
  status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'SUBMITTED', 'APPROVED', 'REJECTED')
);

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_timesheets_customer ON timesheets(organization_id, customer_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_timesheets_rescheduled_from ON timesheets(rescheduled_from_task_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_timesheets_follow_up ON timesheets(organization_id, follow_up_date) WHERE deleted_at IS NULL;
