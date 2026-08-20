-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — MIGRATION 014: ATTENDANCE LOCATION NAMES
-- ============================================================

-- Add human-readable reverse-geocoded location name columns
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_in_location_name VARCHAR(255);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_out_location_name VARCHAR(255);
