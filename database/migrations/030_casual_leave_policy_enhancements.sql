-- Migration 030: Add Casual Leave Policy fields to leave_requests
-- Preserves original requested leave type and records actual deduction type & reason.

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS requested_leave_type_id UUID REFERENCES leave_types(id),
ADD COLUMN IF NOT EXISTS actual_deduction_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS conversion_reason TEXT;

-- Backfill historical rows: requested_leave_type_id defaults to leave_type_id, actual_deduction_type defaults to existing leave_type name
UPDATE leave_requests lr
SET 
  requested_leave_type_id = COALESCE(lr.requested_leave_type_id, lr.leave_type_id),
  actual_deduction_type = COALESCE(lr.actual_deduction_type, (SELECT name FROM leave_types lt WHERE lt.id = lr.leave_type_id))
WHERE lr.requested_leave_type_id IS NULL OR lr.actual_deduction_type IS NULL;
