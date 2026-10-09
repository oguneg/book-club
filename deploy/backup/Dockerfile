# Nightly encrypted database backups with restic (see backup.sh). Same Postgres major version as the
# database, so pg_dump matches the server.
FROM postgres:17-alpine
RUN apk add --no-cache restic curl
COPY entrypoint.sh backup.sh restore.sh counts.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/counts.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
