-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — MIGRATION 005: REMOVE SHIFTS & ROSTERS
-- Safely drop shifts and employee_shifts tables and remove shift_id column
-- ============================================================

-- 1. Drop foreign key constraint & shift_id column from employees table if present
ALTER TABLE IF EXISTS employees DROP COLUMN IF EXISTS shift_id CASCADE;

-- 2. Drop employee_shifts and shifts tables safely
DROP TABLE IF EXISTS employee_shifts CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
