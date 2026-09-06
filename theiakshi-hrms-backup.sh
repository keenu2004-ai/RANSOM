#!/bin/bash
set -Eeuo pipefail

# THEIAKSHI ONE - Production Backup Script
# Location: /usr/local/sbin/theiakshi-hrms-backup

POSTGRES_DIR="/srv/theiakshi-data/backups/postgres"
UPLOADS_DIR="/srv/theiakshi-data/backups/uploads"
MANIFESTS_DIR="/srv/theiakshi-data/backups/manifests"
CONTAINER="theiakshi-postgres"
DB_NAME="theiakshi_hrms"
DB_USER="theiakshi_hrms"
PASSWORD_FILE="/srv/theiakshi-data/secrets/postgres_password"
SOURCE_UPLOADS="/srv/app-data/hrms/uploads"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")

DB_BACKUP_FILE="${POSTGRES_DIR}/hrms-postgres-${TIMESTAMP}.dump"
UPLOADS_BACKUP_FILE="${UPLOADS_DIR}/hrms-uploads-${TIMESTAMP}.tar.gz"
MANIFEST_FILE="${MANIFESTS_DIR}/hrms-backup-${TIMESTAMP}.manifest"

mkdir -p "${POSTGRES_DIR}" "${UPLOADS_DIR}" "${MANIFESTS_DIR}"

echo "[$(date)] Starting database backup..."
docker exec \
    "$CONTAINER" \
    sh -c 'PGPASSWORD="$(cat /run/secrets/postgres_password)" exec pg_dump -U "$1" -d "$2" -Fc' \
    sh "$DB_USER" "$DB_NAME" \
    > "${DB_BACKUP_FILE}.tmp"
mv "${DB_BACKUP_FILE}.tmp" "${DB_BACKUP_FILE}"
echo "[$(date)] Database backup saved to ${DB_BACKUP_FILE}"

echo "[$(date)] Starting uploads backup..."
tar -czf "${UPLOADS_BACKUP_FILE}.tmp" -C "${SOURCE_UPLOADS}" .
mv "${UPLOADS_BACKUP_FILE}.tmp" "${UPLOADS_BACKUP_FILE}"
echo "[$(date)] Uploads backup saved to ${UPLOADS_BACKUP_FILE}"

echo "[$(date)] Generating SHA-256 manifest..."
DB_SHA256=$(sha256sum "${DB_BACKUP_FILE}" | awk '{print $1}')
UPLOADS_SHA256=$(sha256sum "${UPLOADS_BACKUP_FILE}" | awk '{print $1}')
DB_SIZE=$(stat -c%s "${DB_BACKUP_FILE}")
UPLOADS_SIZE=$(stat -c%s "${UPLOADS_BACKUP_FILE}")

# Initialize manifest as PENDING for Google Drive
cat <<EOF > "${MANIFEST_FILE}"
timestamp=${TIMESTAMP}
database=theiakshi_hrms
postgres_dump=hrms-postgres-${TIMESTAMP}.dump
postgres_size=${DB_SIZE}
postgres_sha256=${DB_SHA256}
uploads_archive=hrms-uploads-${TIMESTAMP}.tar.gz
uploads_size=${UPLOADS_SIZE}
uploads_sha256=${UPLOADS_SHA256}
status=SUCCESS
google_drive_backup_status=PENDING
EOF

echo "[$(date)] Starting Google Drive upload as additional stage..."
if docker exec theiakshi-hrms-backend npx ts-node src/scripts/upload_gdrive_backup.ts "/app/backups/postgres/hrms-postgres-${TIMESTAMP}.dump" "/app/backups/uploads/hrms-uploads-${TIMESTAMP}.tar.gz" "/app/backups/manifests/hrms-backup-${TIMESTAMP}.manifest"; then
    echo "[$(date)] Google Drive backup completed successfully."
else
    echo "[$(date)] ERROR: Google Drive backup failed! Local backups remain intact."
    sed -i 's/google_drive_backup_status=PENDING/google_drive_backup_status=FAILED/g' "${MANIFEST_FILE}"
    exit 1
fi

echo "[$(date)] Local backup retention cleanup (14 sets)..."
ls -tp ${POSTGRES_DIR}/hrms-postgres-*.dump | grep -v '/$' | tail -n +15 | xargs -I {} rm -- {} 2>/dev/null || true
ls -tp ${UPLOADS_DIR}/hrms-uploads-*.tar.gz | grep -v '/$' | tail -n +15 | xargs -I {} rm -- {} 2>/dev/null || true
ls -tp ${MANIFESTS_DIR}/hrms-backup-*.manifest | grep -v '/$' | tail -n +15 | xargs -I {} rm -- {} 2>/dev/null || true

echo "[$(date)] Backup completed successfully."
