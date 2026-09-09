#!/bin/bash
set -e

# THEIAKSHI ONE - Restore Script
# This script restores a pg_dump custom-format backup to the PostgreSQL database
# and restores an archive of the uploads directory.

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <db_backup_file> <uploads_backup_file>"
    exit 1
fi

DB_BACKUP_FILE=$1
UPLOADS_BACKUP_FILE=$2
DB_CONTAINER="theiakshi-postgres"

if [ ! -f "${DB_BACKUP_FILE}" ]; then
    echo "Error: Database backup file not found: ${DB_BACKUP_FILE}"
    exit 1
fi

if [ ! -f "${UPLOADS_BACKUP_FILE}" ]; then
    echo "Error: Uploads backup file not found: ${UPLOADS_BACKUP_FILE}"
    exit 1
fi

echo "[$(date)] Starting database restore..."
docker cp "${DB_BACKUP_FILE}" ${DB_CONTAINER}:/tmp/db.dump
docker exec ${DB_CONTAINER} pg_restore -U "${POSTGRES_USER:-theiakshi_user}" -d "${POSTGRES_DB:-theiakshi_one}" -1 -c /tmp/db.dump
docker exec ${DB_CONTAINER} rm /tmp/db.dump
echo "[$(date)] Database restored."

echo "[$(date)] Starting uploads restore..."
# Extract to /srv/theiakshi-data/ (will overwrite the uploads directory)
tar -xzf "${UPLOADS_BACKUP_FILE}" -C /srv/theiakshi-data
echo "[$(date)] Uploads restored."

echo "[$(date)] Restore complete."
