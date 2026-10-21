# Guild Operations

Guild Operations is a self-hosted application for World of Warcraft guilds. One deployment represents one guild. Blizzard remains authoritative for account control, Characters, current guild membership, and numeric guild rank; Guild Operations owns the application facts created by the guild itself.

## Requirements

A normal installation requires Docker with Docker Compose, an address through which Guild Operations can be reached, a Blizzard account that can create an application in the Blizzard Developer Portal, and a current rank-0 Guild Master who can authorize the selected guild.

PostgreSQL is packaged with Guild Operations and is not exposed on the host.

## Install

Clone the repository and start the application:

    git clone https://github.com/heykiditsaaron/guild-operations-stack.git
    cd guild-operations-stack
    docker compose up -d

The web service is published on host port 3100 by default. Browse to the address through which members will reach the application. A new installation automatically redirects the root URL to /setup.

### Optional deployment settings

No .env file is required for an ordinary installation. If host port 3100 is occupied, create .env in the repository root containing:

    HTTP_PORT=8765

A published image may also be pinned instead of using the default latest tag:

    GUILD_OPERATIONS_VERSION=v0.1.0

If Guild Operations is served through a reverse proxy, set the externally reachable origin explicitly (scheme, hostname, and optional port; no path):

    PUBLIC_ORIGIN=https://guild.example.com

Forward this setting to the API container in your Compose deployment. Do not rely on incoming `X-Forwarded-Host` or `X-Forwarded-Proto` headers to establish OAuth callback authority.

These are deployment choices, not application configuration.

## First-run setup

### Setup authorization

Before configuring Blizzard, retrieve the installation-local setup authorization token from the running API container:

    docker compose exec api cat /var/lib/guild-operations/setup-authorization.token

Enter it in the first-run setup form. The token is generated automatically, remains in the installation volume, and is required again if an incomplete setup must be restarted. Treat it as a private host-operator credential. It does **not** grant guild authority; a Blizzard-verified rank-0 Guild Master must still authorize the installation.

### 1. Configure Blizzard

Guild Operations displays the exact OAuth callback URL for the address through which setup was opened. Copy that value and register it for an application in the Blizzard Developer Portal.

Enter the application's Client ID and Client Secret into Guild Operations. They are validated with Blizzard before persistence. The Client Secret is encrypted and does not belong in .env.

### 2. Continue with Blizzard

Authenticate with Blizzard. Guild Operations discovers guild candidates from the account's controlled Characters and current Blizzard data.

### 3. Select the guild

Choose the guild represented by this deployment. Guild Operations corroborates it with Blizzard and acquires its current authoritative roster.

### 4. Authorize the installation

A currently controlled Character belonging to the authenticated Guildie must be a current rank-0 Guild Master of the selected guild. That Blizzard-backed authority authorizes the installation.

Host or deployment control is not guild authority.

After authorization, the installation becomes operational and the root URL opens the normal application.

### Restart an incomplete setup

Before the installation becomes operational, Restart setup is available on the setup screen. It clears the incomplete guild binding, Blizzard application configuration, established public origin, and setup authentication state, then returns to the beginning.

It does not factory-reset the database or delete previously observed Guildies and Characters.

## Persistent data

The packaged deployment uses two Docker named volumes:

| Volume | Purpose |
| --- | --- |
| guild-operations-db | PostgreSQL application and installation state |
| guild-operations-installation | Installation-owned encryption material |

Containers are disposable. Ordinary restarts, replacements, upgrades, and docker compose down leave these volumes intact.

Do not use docker compose down -v unless you intend to delete persistent deployment state.

### Backups

A recoverable backup must preserve both the PostgreSQL data and the installation volume, including /var/lib/guild-operations/installation.key.

The database contains encrypted secrets whose encryption key deliberately lives outside the database. A database backup without the matching installation key is therefore not a complete recoverable backup. Guild Operations will not silently generate a replacement key when encrypted installation secrets already exist.

## Restarting

A normal container restart does not require setup again:

    docker compose down
    docker compose up -d

Inspect the deployment with:

    docker compose ps

Do not add -v during an ordinary restart or update.

## Development and architecture

Customer installation and development topology are intentionally different. Development-only authority facilities are not part of customer installation and must not be used to establish a real deployment.

Implementation and architecture documentation begins at docs/README.md. Core doctrine lives under docs/doctrine/. Repository documentation and implementation are authoritative for development behavior.
