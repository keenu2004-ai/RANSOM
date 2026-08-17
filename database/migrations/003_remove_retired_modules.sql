-- ============================================================
-- THEIAKSHI ENTERPRISE HRMS — MIGRATION 003: REMOVE RETIRED MODULES
-- Safely drop tables belonging exclusively to the 4 retired modules:
-- 1. Compliance & Tax (statutory_rules, compliance_tasks)
-- 2. Document Library (document_types, documents)
-- 3. Announcements (announcements)
-- 4. Helpdesk Support (helpdesk_tickets, ticket_comments)
-- ============================================================

DROP TABLE IF EXISTS ticket_comments CASCADE;
DROP TABLE IF EXISTS helpdesk_tickets CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS document_types CASCADE;
DROP TABLE IF EXISTS compliance_tasks CASCADE;
DROP TABLE IF EXISTS statutory_rules CASCADE;
