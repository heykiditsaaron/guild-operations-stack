#!/bin/sh
# Deployment-local convenience entry point for Guild Operations Host Tools.
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ "$#" -eq 0 ]; then
  exec docker compose run --rm api node dist/host-cli.js
fi
exec docker compose run --rm -T api node dist/host-cli.js "$@"
