-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — MIGRATION 010: ASSET REQUESTS
-- ============================================================

CREATE TABLE IF NOT EXISTS asset_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    category_id UUID REFERENCES asset_categories(id) ON DELETE SET NULL,
    request_number VARCHAR(50) UNIQUE NOT NULL,
    reason TEXT NOT NULL,
    priority VARCHAR(30) NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    required_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'FULFILLED')),
    reviewed_by UUID REFERENCES employees(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    fulfilled_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_asset_requests_org_emp ON asset_requests(organization_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_asset_requests_status ON asset_requests(organization_id, status);
