-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — MIGRATION 007: TRIP EXPENSE MODULE
-- Parent Trip Expenses table & Child tables (Travel, Accommodation, Other)
-- ============================================================

-- 1. Parent Table: trip_expenses
CREATE TABLE IF NOT EXISTS trip_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL,
    start_point VARCHAR(255) NOT NULL,
    end_point VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    bucket VARCHAR(50) DEFAULT 'Internal',
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED', 'PAID')),
    reviewed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Child Table 1: trip_travel_expenses
CREATE TABLE IF NOT EXISTS trip_travel_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_expense_id UUID NOT NULL REFERENCES trip_expenses(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    transport_mode VARCHAR(50) NOT NULL,
    purpose TEXT NOT NULL,
    merchant VARCHAR(255),
    start_location VARCHAR(255) NOT NULL,
    end_location VARCHAR(255) NOT NULL,
    distance_km NUMERIC(10, 2) DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    amount NUMERIC(12, 2) NOT NULL,
    attachment_name VARCHAR(255),
    receipt_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Child Table 2: trip_accommodation_expenses
CREATE TABLE IF NOT EXISTS trip_accommodation_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_expense_id UUID NOT NULL REFERENCES trip_expenses(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    amount NUMERIC(12, 2) NOT NULL,
    accommodation_details TEXT NOT NULL,
    attachment_name VARCHAR(255),
    receipt_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Child Table 3: trip_other_expenses
CREATE TABLE IF NOT EXISTS trip_other_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_expense_id UUID NOT NULL REFERENCES trip_expenses(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    merchant VARCHAR(255),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    amount NUMERIC(12, 2) NOT NULL,
    purpose TEXT NOT NULL,
    attachment_name VARCHAR(255),
    receipt_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for high query performance
CREATE INDEX IF NOT EXISTS idx_trip_expenses_employee ON trip_expenses(organization_id, employee_id, status);
CREATE INDEX IF NOT EXISTS idx_trip_travel_trip_id ON trip_travel_expenses(trip_expense_id);
CREATE INDEX IF NOT EXISTS idx_trip_accom_trip_id ON trip_accommodation_expenses(trip_expense_id);
CREATE INDEX IF NOT EXISTS idx_trip_other_trip_id ON trip_other_expenses(trip_expense_id);
