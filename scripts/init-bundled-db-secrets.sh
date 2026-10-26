#!/bin/sh
# Provision host-owned secrets for a NEW bundled PostgreSQL installation.
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
umask 077
mkdir -p secrets
if [ -e secrets/postgres-password ] || [ -e secrets/database-url ]; then
  echo "Refusing to overwrite existing database credential files." >&2
  exit 1
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required to generate database credentials." >&2
  exit 1
fi
password=$(openssl rand -hex 32)
# A hexadecimal password is URL-safe without percent encoding.
printf '%s\n' "$password" > secrets/postgres-password
printf 'postgresql://guild_operations:%s@db:5432/guild_operations\n' "$password" > secrets/database-url
echo "Created protected bundled database credentials in secrets/."
echo "Use docker compose -f compose.yaml -f compose.bundled-db-secret.yaml up -d"
