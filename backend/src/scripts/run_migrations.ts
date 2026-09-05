import { query } from '../db';

async function setupTables() {
  console.log('--- INITIALIZING PRODUCTION TABLES IN TEST DB ---');

  const statements = [
    `CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) NOT NULL UNIQUE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS employees (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      employee_code VARCHAR(50) NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL,
      status VARCHAR(20) DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS leave_types (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(20) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS leave_balances (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
      leave_type_id UUID REFERENCES leave_types(id) ON DELETE CASCADE,
      year INT NOT NULL,
      quota NUMERIC(5,2) DEFAULT 0,
      used NUMERIC(5,2) DEFAULT 0,
      pending NUMERIC(5,2) DEFAULT 0,
      available NUMERIC(5,2) DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_emp_leave_year UNIQUE(employee_id, leave_type_id, year)
    )`,
    `CREATE TABLE IF NOT EXISTS leave_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
      leave_type_id UUID REFERENCES leave_types(id) ON DELETE CASCADE,
      requested_leave_type_id UUID REFERENCES leave_types(id) ON DELETE CASCADE,
      actual_deduction_type VARCHAR(100),
      conversion_reason TEXT,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      total_days NUMERIC(5,2) NOT NULL,
      reason TEXT,
      status VARCHAR(20) DEFAULT 'PENDING',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS attendance_regularizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
      attendance_date DATE NOT NULL,
      attendance_session_id UUID,
      attendance_type VARCHAR(50),
      original_in_time TIMESTAMPTZ,
      original_out_time TIMESTAMPTZ,
      requested_punch_in TIMESTAMPTZ,
      requested_punch_out TIMESTAMPTZ,
      reason TEXT NOT NULL,
      request_type VARCHAR(50) DEFAULT 'MISSED_PUNCH',
      status VARCHAR(20) DEFAULT 'PENDING',
      submitted_by UUID,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS asset_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
      request_number VARCHAR(100) NOT NULL,
      category_id UUID,
      request_type VARCHAR(50) DEFAULT 'HARDWARE',
      reason TEXT NOT NULL,
      priority VARCHAR(20) DEFAULT 'MEDIUM',
      required_date DATE,
      status VARCHAR(20) DEFAULT 'SUBMITTED',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS trip_expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
      purpose VARCHAR(255) NOT NULL,
      start_point VARCHAR(255),
      end_point VARCHAR(255),
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      currency VARCHAR(10) DEFAULT 'INR',
      total_amount NUMERIC(12,2) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'DRAFT',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
      trip_expense_id UUID REFERENCES trip_expenses(id) ON DELETE CASCADE,
      expense_type VARCHAR(50) NOT NULL DEFAULT 'BUSINESS',
      title VARCHAR(255) NOT NULL DEFAULT 'Expense Claim',
      category VARCHAR(100) NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'INR',
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      transaction_date DATE DEFAULT CURRENT_DATE,
      merchant VARCHAR(255),
      bucket VARCHAR(50),
      transport_mode VARCHAR(50),
      start_location VARCHAR(255),
      end_location VARCHAR(255),
      description TEXT,
      receipt_url TEXT,
      attachment_name VARCHAR(255),
      status VARCHAR(20) DEFAULT 'DRAFT',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS attachments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(255) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      object_path TEXT NOT NULL,
      storage_file_id VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const sql of statements) {
    try {
      await query(sql);
    } catch (err: any) {
      console.error(`Statement error: ${err.message}`);
    }
  }

  // Ensure organization_id columns exist on existing tables if they were created previously without them
  const alters = [
    `ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE`,
    `ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS year INT`,
    `ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS quota NUMERIC(5,2) DEFAULT 0`,
    `ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS pending NUMERIC(5,2) DEFAULT 0`,
    `ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS available NUMERIC(5,2) DEFAULT 0`,
    `ALTER TABLE attendance_regularizations ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE`,
    `ALTER TABLE asset_requests ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE`,
    `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS trip_expense_id UUID REFERENCES trip_expenses(id) ON DELETE CASCADE`
  ];

  for (const sql of alters) {
    try {
      await query(sql);
    } catch (err: any) {
      // ignore if already present or error
    }
  }

  console.log('--- PRODUCTION TABLES INITIALIZED IN TEST DB SUCCESSFULLY ---\n');
}

setupTables().catch(err => {
  console.error('Setup tables failed:', err);
  process.exit(1);
});
