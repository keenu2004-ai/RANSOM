# Risk Register

| ID | Category | Severity | Description | Evidence | Impact | Mitigation | Status |
|---|---|---|---|---|---|---|---|
| R-001 | Security | Low | Microsoft Client ID missing in dev environments causes fail-closed auth. | `microsoftAuthService.ts` line 146 throws `CONFIG_ERROR`. | Dev environment lockout if `.env` is incomplete. | Ensure `MICROSOFT_CLIENT_ID` is seeded in `.env`. | Active |
| R-002 | Operational | High | Nextcloud AIO is a co-located production workload that must not be disrupted. | Explicitly noted in Infrastructure architecture. | Downtime for parallel production services. | Strict Docker network isolation (`internal-net`) and no tampering with Caddy routes not related to HRMS. | Active |
| R-003 | Performance | Medium | Database lacks query optimization for large reporting payloads. | Unoptimized sequential scans observed in complex queries. | High latency on reports. | Addressed in Phase 11 Database Optimization. | Active |
| R-004 | Testing | High | Lack of automated behavioral QA suite. | Phase 10 was manually verified via Node scripts. | High regression risk during large refactors. | Implement CI/CD testing suite in Phase 14. | Active |
