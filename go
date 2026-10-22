#!/bin/sh
# Deployment-local convenience entry point for Guild Operations Host Tools.
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec docker compose run --rm api node dist/host-cli.js "$@"
