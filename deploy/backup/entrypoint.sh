#!/bin/sh
# With a command (backup.sh, restore.sh, counts.sh), run it. Otherwise run backup.sh every night at
# BACKUP_AT (UTC, HH:MM, default 02:30). Without a repository configured, wait quietly: a fresh
# environment shouldn't fail to start just because backups aren't set up yet.
set -eu

if [ "$#" -gt 0 ]; then exec "$@"; fi

if [ -z "${RESTIC_REPOSITORY:-}" ] || [ -z "${RESTIC_PASSWORD:-}" ]; then
  echo "backups are not configured (RESTIC_REPOSITORY / RESTIC_PASSWORD unset); nothing to do"
  exec sleep infinity
fi

at=${BACKUP_AT:-02:30}
# Without the leading zero: shell arithmetic reads 08 as a (bad) octal number.
hours=${at%%:*}; hours=${hours#0}
minutes=${at##*:}; minutes=${minutes#0}
target=$(( hours * 3600 + minutes * 60 ))
echo "nightly backups at $at UTC to $RESTIC_REPOSITORY"
while true; do
  now=$(( $(date -u +%s) % 86400 ))
  wait=$(( (target - now + 86400) % 86400 ))
  [ "$wait" -eq 0 ] && wait=86400
  sleep "$wait"
  # A failure is reported to the heartbeat by backup.sh; keep the schedule going.
  backup.sh || echo "backup failed"
done
