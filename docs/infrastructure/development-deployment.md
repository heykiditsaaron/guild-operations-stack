# Development deployment

Guild Operations has a development Docker Compose stack for live validation of branch work without replacing or reusing the regular deployment.

The regular deployment continues to use `compose.yaml`. Development uses `compose.dev.yaml` and the fixed Compose project name `guild-operations-dev`.

## Isolation

The development stack owns its own:

- API container and network;
- PostgreSQL container and database volume;
- Node modules volume;
- application origin and host ports; and
- environment file.

Development does not load `botghost.env`. A development run must not emit BotGhost publications using production integration configuration.

Default host bindings are:

- application: `3101` -> container `3100`;
- PostgreSQL: `127.0.0.1:15434` -> container `5432`.

The regular Compose file and its volumes are not changed by development-stack commands.

## Environment

Create the ignored development environment file from the tracked template:

```bash
cp .env.dev.example .env.dev
```

Populate the required Blizzard and Discord OAuth client values locally. Do not commit `.env.dev`.

`APP_ORIGIN` defaults to `http://192.168.88.99:3101` in the example. If the development deployment is given a different LAN address or an HTTPS hostname, update `APP_ORIGIN` accordingly.

Blizzard and Discord callback configuration must permit the development origin before authentication can be validated there. Guild Operations derives the callbacks as:

- `${APP_ORIGIN}/auth/blizzard/callback`
- `${APP_ORIGIN}/auth/discord/callback`

## First start

A new development database begins empty. Start PostgreSQL, run migrations against the development database, then start the API:

```bash
cd ~/dev/guild-operations-stack

docker compose -f compose.dev.yaml up -d db
docker compose -f compose.dev.yaml run --rm api npm run migrate
docker compose -f compose.dev.yaml up -d --build api

docker compose -f compose.dev.yaml ps
```

## Normal branch validation

The development deployment follows the branch checked out in the local repository because the development API bind-mounts the working tree intentionally.

To validate a branch:

```bash
cd ~/dev/guild-operations-stack

git fetch --prune
git switch <branch>
git pull --ff-only

docker compose -f compose.dev.yaml up -d --build api
docker compose -f compose.dev.yaml ps
```

Run migrations before the API update when the branch introduces new SQL migrations:

```bash
docker compose -f compose.dev.yaml run --rm api npm run migrate
```

Switching branches therefore affects only the development deployment. It does not replace the regular deployment's Compose project, database volume, or API port.

## Stop and remove

Stop development containers while retaining their database:

```bash
docker compose -f compose.dev.yaml down
```

Destroy the development stack including its database and node-modules volumes only when a full reset is intended:

```bash
docker compose -f compose.dev.yaml down -v
```

`down -v` is destructive only to the `guild-operations-dev` Compose project's volumes. It is not part of normal branch switching or validation.
