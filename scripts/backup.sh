#!/bin/bash
set -euo pipefail

BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

FILENAME="$BACKUP_DIR/niche_inventory_$(date +%Y%m%d_%H%M%S).sql.gz"

echo "Starting database backup..."
docker compose exec -T db pg_dump -U postgres niche_inventory | gzip > "$FILENAME"

# Keep last 30 days of backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

SIZE=$(du -h "$FILENAME" | cut -f1)
echo "Backup saved: $FILENAME ($SIZE)"
echo "Keeping last 30 days of backups"
