# Technical Debt Register

## Current Debt

| ID | Area | Severity | Description | Current Workaround | Recommended Solution | Target Phase | Status |
|---|---|---|---|---|---|---|---|
| TD-002 | Testing | High | Lack of automated end-to-end (E2E) testing suite for core flows. | Manual UAT checklists per phase. | Implement Playwright or Cypress E2E tests. | Phase 14 | Active |
| TD-003 | Storage | Low | Legacy Base64 attachment migration to Google Drive script warns about missing `uploaded_by` column. | Script skips column but functions. | Update migration schema or clean script. | Phase 19 | Active |
| TD-004 | Frontend | Low | Hardcoded legacy roles remain in unused utility files despite `hasPermission` migration. | `hasPermission` is used in active components. | Delete dead code and legacy utilities. | Phase 19 | Active |

## Resolved Debt
- **TD-001 (Database)**: Missing composite indexes on frequently joined columns (e.g., attendance and user tables). (Resolved Phase 11)
- **TD-005 (Auth)**: Frontend localStorage JWT usage replaced with HttpOnly cookies. (Resolved Phase 8)
- **TD-006 (Auth)**: Missing brute-force protection added to `/api/v1/auth`. (Resolved Phase 10)
- **TD-007 (API)**: Fragmented API routes consolidated under `/api/v1`. (Resolved Phase 9)


- Zod Inference on .superRefine() requires manual generic casting at schema usage sites. Currently handled with explicit generic casts.