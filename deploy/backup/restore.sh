#!/bin/sh
# Restores a snapshot into a database and prints its row counts (counts.sh).
#
#   restore.sh                        latest snapshot into a scratch database "restore_check" (a rehearsal:
#                                     the live data is untouched)
#   restore.sh <snapshot> <database>  disaster recovery: stop the app first; the database must be empty
#
# Status goes to stderr, the counts to stdout, so a rehearsal can be compared with the live database.
set -eu
snapshot=${1:-latest}
target=${2:-restore_check}

case "$target" in *[!a-z0-9_]*) echo "database names here are lowercase letters, digits and _" >&2; exit 1 ;; esac

if [ "$target" = "restore_check" ]; then
  psql -q -d postgres -c "drop database if exists restore_check" >&2
fi
if ! psql -At -d postgres -c "select 1 from pg_database where datname = '$target'" | grep -q 1; then
  psql -q -d postgres -c "create database $target" >&2
fi
tables=$(psql -At -d "$target" -c "select count(*) from information_schema.tables where table_schema not in ('pg_catalog', 'information_schema')")
if [ "$tables" != "0" ]; then
  echo "database $target already has tables; restore only into an empty database" >&2
  exit 1
fi

echo "restoring snapshot $snapshot into $target" >&2
restic dump --tag nightly "$snapshot" bookclub.sql | psql -q -v ON_ERROR_STOP=1 -d "$target" >&2
counts.sh "$target"
