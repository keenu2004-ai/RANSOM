-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — MIGRATION 006: EXPENSE CLAIMS UPGRADE
-- Extends expenses table with expense_type, local travel, bucket, currency, attachments & status workflow
-- ============================================================

-- 1. Make category_id nullable for string category support
ALTER TABLE expenses ALTER COLUMN category_id DROP NOT NULL;

-- 2. Add columns for Business Expense & Local Travel Expense
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS expense_type VARCHAR(50) DEFAULT 'BUSINESS',
  ADD COLUMN IF NOT EXISTS transaction_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS merchant VARCHAR(255),
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS bucket VARCHAR(50),
  ADD COLUMN IF NOT EXISTS transport_mode VARCHAR(50),
  ADD COLUMN IF NOT EXISTS start_location VARCHAR(255),
  ADD COLUMN IF NOT EXISTS end_location VARCHAR(255),
  ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255);

-- 3. Update status CHECK constraint to support DRAFT & SUBMITTED
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_status_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_status_check CHECK (status IN ('DRAFT', 'SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED', 'PAID'));
