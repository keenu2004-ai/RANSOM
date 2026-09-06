#!/bin/bash
set -Eeuo pipefail
umask 077

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

cleanup() {
    rm -f "${DB_BACKUP_FILE}.tmp" 2>/dev/null || true
    rm -f "${UPLOADS_BACKUP_FILE}.tmp" 2>/dev/null || true
}
trap cleanup EXIT ERR INT TERM

if [ ! -r "${PASSWORD_FILE}" ]; then
    echo "ERROR: Password secret unreadable or missing at ${PASSWORD_FILE}"
    exit 1
fi

if [ ! -d "${SOURCE_UPLOADS}" ]; then
    echo "ERROR: Uploads source directory missing at ${SOURCE_UPLOADS}"
    exit 1
fi

if ! docker inspect -f '{{.State.Running}}' "${CONTAINER}" 2>/dev/null | grep -q 'true'; then
    echo "ERROR: Database container ${CONTAINER} is not running"
    exit 1
fi

mkdir -p "${POSTGRES_DIR}" "${UPLOADS_DIR}" "${MANIFESTS_DIR}"

echo "[$(date)] Starting database backup..."
docker exec \
    "$CONTAINER" \
    sh -c 'PGPASSWORD="$(cat /run/secrets/postgres_password)" exec pg_dump -U "$1" -d "$2" -Fc' \
    sh "$DB_USER" "$DB_NAME" \
    > "${DB_BACKUP_FILE}.tmp"

if [ ! -s "${DB_BACKUP_FILE}.tmp" ]; then
    echo "ERROR: Database backup is empty"
    exit 1
fi
mv "${DB_BACKUP_FILE}.tmp" "${DB_BACKUP_FILE}"
echo "[$(date)] Database backup saved to ${DB_BACKUP_FILE}"

echo "[$(date)] Starting uploads backup..."
tar -czf "${UPLOADS_BACKUP_FILE}.tmp" -C "${SOURCE_UPLOADS}" .
if [ ! -s "${UPLOADS_BACKUP_FILE}.tmp" ]; then
    echo "ERROR: Uploads backup is empty"
    exit 1
fi
mv "${UPLOADS_BACKUP_FILE}.tmp" "${UPLOADS_BACKUP_FILE}"
echo "[$(date)] Uploads backup saved to ${UPLOADS_BACKUP_FILE}"

echo "[$(date)] Generating SHA-256 manifest..."
DB_SHA256=$(sha256sum "${DB_BACKUP_FILE}" | awk '{print $1}')
UPLOADS_SHA256=$(sha256sum "${UPLOADS_BACKUP_FILE}" | awk '{print $1}')
DB_SIZE=$(stat -c%s "${DB_BACKUP_FILE}")
UPLOADS_SIZE=$(stat -c%s "${UPLOADS_BACKUP_FILE}")

cat <<EOF > "${MANIFEST_FILE}"
timestamp=${TIMESTAMP}
database=${DB_NAME}
postgres_dump=hrms-postgres-${TIMESTAMP}.dump
postgres_size=${DB_SIZE}
postgres_sha256=${DB_SHA256}
uploads_archive=hrms-uploads-${TIMESTAMP}.tar.gz
uploads_size=${UPLOADS_SIZE}
uploads_sha256=${UPLOADS_SHA256}
status=SUCCESS
google_drive_backup_status=PENDING
EOF

echo "[$(date)] Local backup created successfully."

echo "[$(date)] Starting Google Drive upload as additional stage..."
if docker exec theiakshi-hrms-backend npx ts-node src/scripts/upload_gdrive_backup.ts "/app/backups/postgres/hrms-postgres-${TIMESTAMP}.dump" "/app/backups/uploads/hrms-uploads-${TIMESTAMP}.tar.gz" "/app/backups/manifests/hrms-backup-${TIMESTAMP}.manifest"; then
    echo "[$(date)] Google Drive backup completed successfully."
else
    echo "[$(date)] ERROR: Google Drive backup failed! Local backups remain intact."
    sed -i 's/google_drive_backup_status=PENDING/google_drive_backup_status=FAILED/g' "${MANIFEST_FILE}"
    exit 1
fi

echo "[$(date)] Local backup retention cleanup (14 sets)..."
find "${POSTGRES_DIR}" -type f -name "hrms-postgres-*.dump" | sort -r | tail -n +15 | xargs -r rm -f
find "${UPLOADS_DIR}" -type f -name "hrms-uploads-*.tar.gz" | sort -r | tail -n +15 | xargs -r rm -f
find "${MANIFESTS_DIR}" -type f -name "hrms-backup-*.manifest" | sort -r | tail -n +15 | xargs -r rm -f

echo "[$(date)] Backup completed successfully."
