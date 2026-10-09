#!/bin/sh
# One snapshot of the database into the restic repository. restic encrypts it with RESTIC_PASSWORD
# before anything leaves the server, deduplicates against earlier nights and compresses.
#
# Left out: the data of the cache tables (book lookups, covers); they refill themselves from the
# providers. Kept: 14 daily and 8 weekly snapshots, so deleted data is gone from backups within 60 days
# (the privacy policy says so). Each run reads back a sample of the stored data to catch a damaged
# repository early, then pings BACKUP_HEARTBEAT_URL (or its /fail address if anything went wrong).
set -eu

heartbeat() {
  [ -n "${BACKUP_HEARTBEAT_URL:-}" ] || return 0
  curl -fsS -m 10 --retry 3 -o /dev/null "${BACKUP_HEARTBEAT_URL}$1" || echo "heartbeat ping failed"
}
trap 'heartbeat /fail' EXIT

restic cat config >/dev/null 2>&1 || restic init
restic backup --tag nightly --stdin-filename bookclub.sql --stdin-from-command -- \
  pg_dump --no-owner --no-privileges --exclude-table-data=book_cache --exclude-table-data=cover
restic forget --tag nightly --keep-daily 14 --keep-weekly 8 --prune
restic check --read-data-subset=10%

trap - EXIT
heartbeat ""
echo "backup done"
