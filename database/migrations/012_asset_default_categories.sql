-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — MIGRATION 012: DEFAULT ASSET CATEGORIES
-- ============================================================

-- Ensure default asset categories exist for baseline organizations
INSERT INTO asset_categories (id, organization_id, name, code, description, is_active)
SELECT 
  gen_random_uuid(),
  o.id,
  cat.name,
  cat.code,
  cat.description,
  TRUE
FROM organizations o
CROSS JOIN (
  VALUES 
    ('Electronic', 'CAT-ELECTRONIC', 'Electronic equipment, devices & appliances'),
    ('Hardware', 'CAT-HARDWARE', 'IT hardware, laptops, servers & computer peripherals'),
    ('Parts', 'CAT-PARTS', 'Component parts, spare parts & replacement modules'),
    ('Machine', 'CAT-MACHINE', 'Industrial machines, lab tools & heavy equipment')
) AS cat(name, code, description)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description;
