#!/usr/bin/env bash
# Update a running environment to the latest commit on GitHub. Run on the VPS:
#   ~/book-club-staging/deploy/update.sh
# Also run by GitHub Actions after each push to main, through a deploy key that can run nothing else.
#
# Everything is inside main() so bash parses the whole file before running it: `git pull` may
# replace this file mid-run. After pulling, the script re-executes the fresh version.
set -euo pipefail

main() {
  cd "$(dirname "$0")/.."

  if [ -z "${BOOKCLUB_PULLED:-}" ]; then
    git pull --ff-only --quiet
    BOOKCLUB_PULLED=1 exec "$0" "$@"
  fi

  local commit deployed status=""
  commit=$(git rev-parse --short=7 HEAD)
  deployed=$(cat .deployed 2>/dev/null || true)
  echo "code: ${deployed:-none} -> $commit"
  if [ "$commit" = "$deployed" ] && [ -n "$(docker compose ps -q app)" ]; then
    echo "already up to date"
    return 0
  fi

  # Build first while the old container keeps serving, then swap (a few seconds of restart).
  # The app applies database migrations on start, before it reports healthy.
  export GIT_COMMIT="$commit"
  docker compose build --quiet app
  docker compose up -d --remove-orphans

  for _ in $(seq 1 60); do
    status=$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q app)" 2>/dev/null || true)
    [ "$status" = "healthy" ] && break
    sleep 2
  done
  echo "app: ${status:-unknown}"

  # Remove old image layers and week-old build cache so the disk doesn't fill up over many deploys.
  docker image prune -f >/dev/null
  docker builder prune -f --filter until=168h >/dev/null

  if [ "$status" != "healthy" ]; then
    docker compose logs --tail 50 app
    return 1
  fi
  echo "$commit" > .deployed
}

main "$@"
