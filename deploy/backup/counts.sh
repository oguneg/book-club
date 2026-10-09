#!/bin/sh
# Row counts per table in a database (default PGDATABASE), skipping the cache tables that backups leave
# empty. Used to compare a restored copy with the original.
set -eu
db=${1:-$PGDATABASE}
psql -At -d "$db" -c "select table_schema || '.' || table_name from information_schema.tables
  where table_schema not in ('pg_catalog', 'information_schema') and table_type = 'BASE TABLE'
    and table_name not in ('book_cache', 'cover') order by 1" |
  while read -r table; do
    printf '%s %s\n' "$table" "$(psql -At -d "$db" -c "select count(*) from $table")"
  done
