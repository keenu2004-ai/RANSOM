-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — MIGRATION 015: NUMERIC LEAVE BALANCES
-- ============================================================

-- Change leave_balances columns from INT to NUMERIC(5, 2) to allow fractional & decimal leave days (e.g., 1.0, 0.5)
ALTER TABLE leave_balances ALTER COLUMN quota TYPE NUMERIC(5, 2);
ALTER TABLE leave_balances ALTER COLUMN used TYPE NUMERIC(5, 2);
ALTER TABLE leave_balances ALTER COLUMN pending TYPE NUMERIC(5, 2);
ALTER TABLE leave_balances ALTER COLUMN available TYPE NUMERIC(5, 2);
