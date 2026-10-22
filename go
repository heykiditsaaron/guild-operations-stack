#!/bin/sh
# Deployment-local convenience entry point for Guild Operations Host Tools.
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# Keep routine container creation messages out of the host operator's console.
# Do not redirect stderr: Docker and application failures must remain visible.
if [ "$#" -eq 0 ]; then
  exec docker compose --progress quiet run --rm --no-deps api node dist/host-cli.js
fi
exec docker compose --progress quiet run --rm --no-deps -T api node dist/host-cli.js "$@"
