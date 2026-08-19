-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — MIGRATION 008: REMOVE PAYROLL & PAYSLIPS
-- Safe Removal of Payroll & Payslip transactional & structure tables
-- ============================================================

DROP TABLE IF EXISTS payroll_records CASCADE;
DROP TABLE IF EXISTS salary_structures CASCADE;
