#!/usr/bin/env bash
set -euo pipefail

# SIPGN-BGN PostgreSQL Backup Script
# Jalankan via cron, contoh: 0 2 * * * /app/src/scripts/backup.sh

BACKUP_DIR="${BACKUP_DIR:-/var/backups/sipgn}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="sipgn_bgn_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL belum di-set" >&2
  exit 1
fi

echo "[backup] Memulai pg_dump ke ${BACKUP_DIR}/${FILENAME}"
pg_dump --no-owner --no-acl "$DATABASE_URL" | gzip -9 > "${BACKUP_DIR}/${FILENAME}"

SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | awk '{print $1}')
echo "[backup] Selesai. Ukuran: ${SIZE}"

echo "[backup] Membersihkan backup > ${RETENTION_DAYS} hari..."
find "$BACKUP_DIR" -name "sipgn_bgn_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

if [ -n "${BACKUP_NOTIFY_EMAIL:-}" ] && command -v mail >/dev/null 2>&1; then
  echo "Backup SIPGN-BGN selesai: ${FILENAME} (${SIZE})" | mail -s "[SIPGN-BGN] Backup OK" "${BACKUP_NOTIFY_EMAIL}"
fi

echo "[backup] Sukses."
