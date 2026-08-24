-- Migration 019: GCS Attachment Metadata, Report Archives, and User Display Names

-- 1. Add display_name column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);

-- Seed default display name for superadmin
UPDATE users 
SET display_name = 'Vaibhav Arya' 
WHERE LOWER(email) = 'superadmin@theiakshi.com' AND (display_name IS NULL OR display_name = '');

-- 2. Attachments / File Metadata Table
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- 'EXPENSE', 'TRIP_EXPENSE', 'WEEKLY_PLAN', 'REPORT', 'EMPLOYEE_DOC'
    entity_id UUID,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    original_filename VARCHAR(255) NOT NULL,
    object_path TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    checksum VARCHAR(64),
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_attachments_org_entity ON attachments(organization_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_attachments_emp ON attachments(employee_id);

-- 3. Report Archives Table
CREATE TABLE IF NOT EXISTS report_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    report_name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL, -- 'WEEKLY_PLAN', 'MONTHLY_REPORT'
    period_year INT NOT NULL,
    period_month INT,
    object_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    generated_by_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_report_archives_org_type ON report_archives(organization_id, report_type, period_year);
