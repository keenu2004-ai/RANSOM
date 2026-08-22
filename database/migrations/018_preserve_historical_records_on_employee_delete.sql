-- ============================================================
-- MIGRATION 018: PRESERVE HISTORICAL RECORDS ON EMPLOYEE DELETE
-- Converts ON DELETE CASCADE to ON DELETE SET NULL on historical tables
-- Adds immutable identity snapshots (name, code, email)
-- ============================================================

-- 1. ATTENDANCE TABLE
ALTER TABLE attendance ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_employee_id_fkey;
ALTER TABLE attendance ADD CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS employee_name_snapshot VARCHAR(255);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS employee_code_snapshot VARCHAR(50);

-- 2. ATTENDANCE REGULARIZATIONS TABLE
ALTER TABLE attendance_regularizations ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE attendance_regularizations DROP CONSTRAINT IF EXISTS attendance_regularizations_employee_id_fkey;
ALTER TABLE attendance_regularizations ADD CONSTRAINT attendance_regularizations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE attendance_regularizations ADD COLUMN IF NOT EXISTS employee_name_snapshot VARCHAR(255);
ALTER TABLE attendance_regularizations ADD COLUMN IF NOT EXISTS employee_code_snapshot VARCHAR(50);

-- 3. LEAVE BALANCES TABLE
ALTER TABLE leave_balances ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE leave_balances DROP CONSTRAINT IF EXISTS leave_balances_employee_id_fkey;
ALTER TABLE leave_balances ADD CONSTRAINT leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- 4. LEAVE REQUESTS TABLE
ALTER TABLE leave_requests ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_employee_id_fkey;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS employee_name_snapshot VARCHAR(255);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS employee_code_snapshot VARCHAR(50);

-- 5. EXPENSES TABLE
ALTER TABLE expenses ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_employee_id_fkey;
ALTER TABLE expenses ADD CONSTRAINT expenses_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS employee_name_snapshot VARCHAR(255);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS employee_code_snapshot VARCHAR(50);

-- 6. TIMESHEETS TABLE
ALTER TABLE timesheets ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_employee_id_fkey;
ALTER TABLE timesheets ADD CONSTRAINT timesheets_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS employee_name_snapshot VARCHAR(255);
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS employee_code_snapshot VARCHAR(50);

-- 7. TRIP EXPENSES TABLES
ALTER TABLE trip_expenses ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE trip_expenses DROP CONSTRAINT IF EXISTS trip_expenses_employee_id_fkey;
ALTER TABLE trip_expenses ADD CONSTRAINT trip_expenses_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE trip_expenses ADD COLUMN IF NOT EXISTS employee_name_snapshot VARCHAR(255);
ALTER TABLE trip_expenses ADD COLUMN IF NOT EXISTS employee_code_snapshot VARCHAR(50);

ALTER TABLE trip_travel_expenses ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE trip_travel_expenses DROP CONSTRAINT IF EXISTS trip_travel_expenses_employee_id_fkey;
ALTER TABLE trip_travel_expenses ADD CONSTRAINT trip_travel_expenses_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE trip_accommodation_expenses ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE trip_accommodation_expenses DROP CONSTRAINT IF EXISTS trip_accommodation_expenses_employee_id_fkey;
ALTER TABLE trip_accommodation_expenses ADD CONSTRAINT trip_accommodation_expenses_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE trip_other_expenses ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE trip_other_expenses DROP CONSTRAINT IF EXISTS trip_other_expenses_employee_id_fkey;
ALTER TABLE trip_other_expenses ADD CONSTRAINT trip_other_expenses_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- 8. ASSET REQUESTS TABLE
ALTER TABLE asset_requests ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE asset_requests DROP CONSTRAINT IF EXISTS asset_requests_employee_id_fkey;
ALTER TABLE asset_requests ADD CONSTRAINT asset_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- 9. EMPLOYEE LEAVE ADJUSTMENTS TABLE
ALTER TABLE employee_leave_adjustments ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE employee_leave_adjustments DROP CONSTRAINT IF EXISTS employee_leave_adjustments_employee_id_fkey;
ALTER TABLE employee_leave_adjustments ADD CONSTRAINT employee_leave_adjustments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE employee_leave_adjustments ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE employee_leave_adjustments DROP CONSTRAINT IF EXISTS employee_leave_adjustments_created_by_fkey;
ALTER TABLE employee_leave_adjustments ADD CONSTRAINT employee_leave_adjustments_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE employee_leave_adjustments ADD COLUMN IF NOT EXISTS employee_name_snapshot VARCHAR(255);
ALTER TABLE employee_leave_adjustments ADD COLUMN IF NOT EXISTS employee_code_snapshot VARCHAR(50);

-- 10. AUDIT LOGS TABLE
ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_email_snapshot VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS employee_name_snapshot VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS employee_code_snapshot VARCHAR(50);

-- Backfill existing snapshot columns where employees / users currently exist
UPDATE attendance a SET 
  employee_name_snapshot = CONCAT(e.first_name, ' ', e.last_name),
  employee_code_snapshot = e.employee_code
FROM employees e WHERE a.employee_id = e.id AND a.employee_name_snapshot IS NULL;

UPDATE leave_requests l SET 
  employee_name_snapshot = CONCAT(e.first_name, ' ', e.last_name),
  employee_code_snapshot = e.employee_code
FROM employees e WHERE l.employee_id = e.id AND l.employee_name_snapshot IS NULL;

UPDATE expenses ex SET 
  employee_name_snapshot = CONCAT(e.first_name, ' ', e.last_name),
  employee_code_snapshot = e.employee_code
FROM employees e WHERE ex.employee_id = e.id AND ex.employee_name_snapshot IS NULL;

UPDATE timesheets t SET 
  employee_name_snapshot = CONCAT(e.first_name, ' ', e.last_name),
  employee_code_snapshot = e.employee_code
FROM employees e WHERE t.employee_id = e.id AND t.employee_name_snapshot IS NULL;

UPDATE trip_expenses te SET 
  employee_name_snapshot = CONCAT(e.first_name, ' ', e.last_name),
  employee_code_snapshot = e.employee_code
FROM employees e WHERE te.employee_id = e.id AND te.employee_name_snapshot IS NULL;

UPDATE audit_logs al SET 
  user_email_snapshot = u.email,
  employee_name_snapshot = CONCAT(e.first_name, ' ', e.last_name),
  employee_code_snapshot = e.employee_code
FROM users u 
LEFT JOIN employees e ON e.user_id = u.id 
WHERE al.user_id = u.id AND al.user_email_snapshot IS NULL;
