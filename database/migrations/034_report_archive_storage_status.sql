-- Migration 034: Add storage status tracking to report archives

ALTER TABLE report_archives
ADD COLUMN IF NOT EXISTS storage_status VARCHAR(50) DEFAULT 'AVAILABLE';
