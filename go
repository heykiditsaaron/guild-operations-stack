#!/bin/sh
# Deployment-local convenience entry point for Guild Operations Host Tools.
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
# Host Tools do not start or migrate the application just to open a console.
# Commands requiring services must report their own readiness requirements.
if [ "$#" -eq 0 ]; then
  exec docker compose run --rm --no-deps api node dist/host-cli.js
fi
exec docker compose run --rm --no-deps -T api node dist/host-cli.js "$@"
