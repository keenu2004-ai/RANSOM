#!/bin/bash
set -e

# THEIAKSHI ONE - Backup Script
# This script creates a pg_dump custom-format backup of the PostgreSQL database
# and an archive of the uploads directory.

BACKUP_DIR="/srv/theiakshi-data/backups"
DB_CONTAINER="theiakshi-postgres"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_BACKUP_FILE="${BACKUP_DIR}/db_${TIMESTAMP}.dump"
UPLOADS_BACKUP_FILE="${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting database backup..."
# Uses the environment variables from the postgres container
docker exec ${DB_CONTAINER} pg_dump -U "${POSTGRES_USER:-theiakshi_user}" -Fc -d "${POSTGRES_DB:-theiakshi_one}" -f "/tmp/db.dump"
docker cp ${DB_CONTAINER}:/tmp/db.dump "${DB_BACKUP_FILE}"
docker exec ${DB_CONTAINER} rm /tmp/db.dump
echo "[$(date)] Database backup saved to ${DB_BACKUP_FILE}"

echo "[$(date)] Starting uploads backup..."
tar -czf "${UPLOADS_BACKUP_FILE}" -C /srv/theiakshi-data uploads
echo "[$(date)] Uploads backup saved to ${UPLOADS_BACKUP_FILE}"

# Note: Encrypted backup support and offsite transmission (e.g., via rsync or S3) 
# should be configured here before relying on this for disaster recovery.
echo "[$(date)] Backup complete."
