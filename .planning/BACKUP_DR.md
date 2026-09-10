# Backup & Disaster Recovery (DR)

## Status
IMPLEMENTED

## Overview
THEIAKSHI ONE maintains a persistent volume strategy paired with automated backups for disaster recovery.

## Storage Volumes
- `/srv/theiakshi-data/postgres`: Database data
- `/srv/theiakshi-data/uploads`: User-uploaded files
- `/srv/theiakshi-data/backups`: Local backup archives
- `/srv/theiakshi-data/secrets/google_drive_backup.env`: Off-site backup credentials
- `/srv/theiakshi-data/secrets/postgres_password`: Database secure authentication secret for offline pg_dump operations.

## Backup Mechanisms
1. **Local Archives**: The application is configured to create periodic dumps of the PostgreSQL database and compress the `uploads` directory.
2. **Off-site Google Drive Backup**: The system integrates with Google Drive APIs to ship compressed backup tarballs off-site.

## Recovery Time Objective (RTO) & Recovery Point Objective (RPO)
- RPO and RTO are currently unverified (Testing pending in Phase 15 - DevOps & Deployment Review).
- **Known Reporting Inconsistencies**: There is a known discrepancy where the local backup manifest and the remote finalized manifest may fall out of sync if an upload fails mid-stream. This technical debt requires resolution.

## Verification
- Recovery testing has not been formally conducted in the current engineering loop.
- It is strictly required to test a full bare-metal restoration from the Google Drive archives before Phase 20 sign-off.
