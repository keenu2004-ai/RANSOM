-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — MIGRATION 022: GOOGLE DRIVE STORAGE
-- Add provider-neutral and Google Drive specific storage columns
-- ============================================================

ALTER TABLE attachments ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(50) DEFAULT 'GOOGLE_DRIVE';
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS storage_file_id VARCHAR(255);
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS storage_folder_id VARCHAR(255);
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS storage_status VARCHAR(50) DEFAULT 'AVAILABLE';

ALTER TABLE report_archives ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(50) DEFAULT 'GOOGLE_DRIVE';
ALTER TABLE report_archives ADD COLUMN IF NOT EXISTS storage_file_id VARCHAR(255);
ALTER TABLE report_archives ADD COLUMN IF NOT EXISTS storage_folder_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_attachments_storage_file ON attachments(storage_file_id);
CREATE INDEX IF NOT EXISTS idx_report_archives_storage_file ON report_archives(storage_file_id);
