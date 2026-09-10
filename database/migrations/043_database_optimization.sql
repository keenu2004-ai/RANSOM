-- ====================================================================================
-- Migration: 043_database_optimization.sql
-- Description: Phase 11 Database Optimization - Core Indexes
-- ====================================================================================

-- 1. USERS Table
-- Frequently filtered by organization_id for tenant isolation
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users (organization_id);
-- Microsoft SSO lookup
CREATE INDEX IF NOT EXISTS idx_users_microsoft_oid ON users (microsoft_oid);

-- 2. EMPLOYEES Table
-- Core tenant isolation filter
CREATE INDEX IF NOT EXISTS idx_employees_organization_id ON employees (organization_id);
-- Fast lookup from AuthContext (user_id) to Employee profile
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees (user_id);

-- 3. EXPENSES Table
-- Essential for management analytics and tenant-level fetching
CREATE INDEX IF NOT EXISTS idx_expenses_organization_id ON expenses (organization_id);
-- Speeds up employee-specific expense list fetching
CREATE INDEX IF NOT EXISTS idx_expenses_employee_id ON expenses (employee_id);

-- 4. TRIP_EXPENSES Table
-- Essential for CTE analytics joins
CREATE INDEX IF NOT EXISTS idx_trip_expenses_organization_id ON trip_expenses (organization_id);

-- 5. LEAVE_BALANCES Table
-- Frequently fetched for all employees in an organization
CREATE INDEX IF NOT EXISTS idx_leave_balances_organization_id ON leave_balances (organization_id);

-- 6. ASSETS Table - only create if assigned_to_employee_id exists (column may not be present in all schema paths)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'assigned_to_employee_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_assets_assigned_employee ON assets (assigned_to_employee_id)';
  END IF;
END $$;

-- 7. ATTENDANCE Table
-- Although idx_attendance_org_emp_date_desc exists, a pure organization_id + date index 
-- helps large-scale daily reports across the whole organization
CREATE INDEX IF NOT EXISTS idx_attendance_org_date ON attendance (organization_id, date);
