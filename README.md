# Guild Operations

Guild Operations is a self-hosted application for World of Warcraft guilds. One deployment represents one guild. Blizzard remains authoritative for account control, Characters, current guild membership, and numeric guild rank; Guild Operations owns the application facts created by the guild itself.

## Requirements

A normal installation requires Docker with Docker Compose, an address through which Guild Operations can be reached, a Blizzard account that can create an application in the Blizzard Developer Portal, and a current rank-0 Guild Master who can authorize the selected guild.

PostgreSQL is packaged with Guild Operations and is not exposed on the host.

## Install

Clone the repository, configure the host-owned settings, and start the deployment:

```sh
git clone https://github.com/heykiditsaaron/guild-operations-stack.git
cd guild-operations-stack
cp .env.example .env
```

Edit `.env` to provide `PUBLIC_ORIGIN` (the canonical externally reachable origin, including `https://`), `BLIZZARD_CLIENT_ID`, and `BLIZZARD_CLIENT_SECRET`. Blizzard OAuth must allow the callback URL for that public origin. Discord integration is optional; when enabled, provide `DISCORD_APPLICATION_ID`, `DISCORD_CLIENT_SECRET`, and `DISCORD_BOT_TOKEN` for the same Discord application. The host owns these credentials; they are not entered through Guild Settings.

Protect the environment file (`chmod 600 .env`) and do not commit it. Host-managed credential files are also supported via `compose.blizzard-secret.yaml` and `compose.discord-secret.yaml` as documented in `.env.example`; use those overrides instead of direct values for the corresponding credentials.

```sh
sh scripts/init-bundled-db-secrets.sh
docker compose -f compose.yaml -f compose.bundled-db-secret.yaml up -d
docker compose -f compose.yaml -f compose.bundled-db-secret.yaml ps
```

For a **new installation**, the provisioning script creates a random 256-bit PostgreSQL password and a matching database connection URL in ignored, protected files under `secrets/`. Keep these files with the deployment and include them in secure backups. Always use the same Compose file pair for subsequent starts, stops, updates, and inspection. The script refuses to overwrite existing credential files. **Do not run this provisioning sequence against an existing bundled database volume:** PostgreSQL only consumes `POSTGRES_PASSWORD_FILE` during initial database initialization, and replacing the application connection URL would disconnect it. Existing deployments using legacy credentials continue using their original Compose configuration until a deliberate database credential migration is performed.

The bundled PostgreSQL service is started automatically and is not published to the host. The web service uses host port 3000 by default; set `HTTP_PORT` in `.env` to change it. The image defaults to `:latest`; set `GUILD_OPERATIONS_VERSION` to a specific release for a pinned deployment or `dev` for development.

### External PostgreSQL

For a PostgreSQL server managed independently of Guild Operations, use the standalone Compose topology rather than layering it on the bundled topology:

```sh
# Configure DATABASE_URL in the protected .env file first.
docker compose -f compose.external-db.yaml config --services
docker compose -f compose.external-db.yaml up -d
```

The service list must contain `migrate`, `api`, and `discord`, **not** `db`. Set `DATABASE_URL` to a PostgreSQL URL containing the database, host, and application credentials. Provision the database and user on the external server before starting. Guild Operations continues to run its own schema migrations through the one-shot `migrate` service. The host/provider owns PostgreSQL server availability, TLS policy, credentials, backups, and restoration.

To keep the connection URL in a protected file rather than `.env`, place it in `./secrets/database-url` and use both files in this order:

```sh
docker compose -f compose.external-db.yaml -f compose.database-secret.yaml up -d
```

Do not use `compose.yaml` in the external database command: it includes the bundled `db` service. Do not switch an existing installation to a fresh external database without a planned data migration and verified backup. The installation encryption key must remain paired with the migrated database state.

**Existing installations:** the original `docker compose up -d` configuration retains fixed legacy PostgreSQL credentials for backward compatibility. Use the protected credential overlay for new installations only. Credential rotation for existing databases is a separate, explicit migration; never rotate merely by changing Compose environment variables. Do not combine `compose.bundled-db-secret.yaml` with `compose.database-secret.yaml` or the external database topology.

### Host Tools

The deployment-local `./go` launcher runs the Host Tools CLI from the selected application image:

```sh
./go
./go help
./go version
```

Host Tools currently provides console, help, and version commands. Installation and recovery commands are not yet available. The host-side launcher must be updated alongside deployment files when upgrading.

## First-run setup

With host configuration in place, open the public origin in a browser. A new installation redirects to `/setup`. Sign in with Blizzard, choose an eligible guild from the Blizzard-backed candidates, and authorize it as the current rank-0 Guild Master. Host access does not grant guild authority.

Blizzard credentials and public origin are configured on the host, **not** through the browser setup wizard. A separate System Administration service and setup-token bootstrap are not part of this deployment.

Discord application credentials are likewise host-owned. Guild-authorized operators configure the Discord server, channels, and integration enablement in Guild Settings. Replacing the Discord application identity requires explicit reconnection; rotating credentials for the same application does not require reselecting guild-owned settings.

## Persistent data

The packaged bundled-database deployment uses two Docker named volumes:

| Volume | Purpose |
| --- | --- |
| guild-operations-db | PostgreSQL application and installation state |
| guild-operations-installation | Installation-owned encryption material |

Containers are disposable. Ordinary restarts, replacements, upgrades, and docker compose down leave these volumes intact.

Do not use docker compose down -v unless you intend to delete persistent deployment state.

### Backups

A recoverable backup must preserve both the PostgreSQL data and the installation volume, including /var/lib/guild-operations/installation.key.

Preserve the installation volume alongside the database for continuity and recovery. Also back up the host-owned configuration and credential material separately and securely; a database backup alone does not capture these host settings.

## Restarting

A normal container restart does not require setup again:

    docker compose down
    docker compose up -d

Inspect the deployment with:

    docker compose ps

Do not add -v during an ordinary restart or update.

## Development image publishing

To test a feature branch before merging, push the branch and use **Actions → Publish Guild Operations Image → Run workflow**, selecting that branch. A manual run against a branch publishes `ghcr.io/heykiditsaaron/guild-operations:dev` and a commit-SHA image tag. Development deployments may opt into `GUILD_OPERATIONS_VERSION=dev`; this mutable tag represents the most recently manually published branch, not necessarily `main`, and must not be used for pinned production deployments. A push to `main` does not overwrite `:dev`. Publishing an image does not restart any deployment: operators explicitly pull and recreate services when ready. Version-tagged releases continue to publish independently. The original installation's full development deployment and health-check procedure is documented in [docs/infrastructure/development-deployment.md](docs/infrastructure/development-deployment.md).

## Development and architecture

Customer installation and development topology are intentionally different. Development-only authority facilities are not part of customer installation and must not be used to establish a real deployment.

Implementation and architecture documentation begins at docs/README.md. Core doctrine lives under docs/doctrine/. Repository documentation and implementation are authoritative for development behavior.
