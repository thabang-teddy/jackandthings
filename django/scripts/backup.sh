#!/bin/bash
# Copy to ~/bin/backup.sh on the SERVER (chmod 700). Replace USER_jat with your database name.
set -euo pipefail
STAMP=$(date +%F)
mysqldump --defaults-file="$HOME/.my.cnf" --single-transaction --routines USER_jat | gzip > "$HOME/backups/db-$STAMP.sql.gz"
if [ "$(date +%u)" = "7" ]; then tar -czf "$HOME/backups/media-$STAMP.tar.gz" -C "$HOME" private_media; fi
find "$HOME/backups" -name '*.gz' -mtime +14 -delete
