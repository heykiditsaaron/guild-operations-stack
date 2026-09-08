# Development deployment

Guild Operations has a development Docker Compose stack for live validation of branch work without replacing or reusing the regular deployment.

The regular deployment continues to use `compose.yaml` from the regular checkout at `~/dev/guild-operations-stack`. Development uses `compose.dev.yaml` from a separate Git worktree at `~/dev/guild-operations-stack-dev` and the fixed Compose project name `guild-operations-dev`.

## Isolation

The development deployment is isolated at two levels.

First, it runs from its own Git worktree. This is required because the regular Compose stack bind-mounts its checkout into the running API container. Switching branches in the regular checkout could therefore alter the regular running application even without restarting its containers.

Second, the development Compose project owns its own:

- API container and network;
- PostgreSQL container and database volume;
- Node modules volume;
- application origin and host ports; and
- environment file.

Default host bindings are:

- application: `3101` -> container `3100`;
- PostgreSQL: `127.0.0.1:15434` -> container `5432`.

The regular checkout, Compose project, ports, and volumes are not changed by development-stack commands.

## Create the development worktree

From the regular checkout, create a dedicated worktree once:

```bash
cd ~/dev/guild-operations-stack

git fetch --prune
git worktree add ~/dev/guild-operations-stack-dev development-deployment
```

After the development-deployment infrastructure is merged, the worktree may be switched to any branch being validated without touching the regular checkout.

## Environment

Inside the development worktree, create the ignored development environment file from the tracked template:

```bash
cd ~/dev/guild-operations-stack-dev
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
cd ~/dev/guild-operations-stack-dev

docker compose -f compose.dev.yaml up -d db
docker compose -f compose.dev.yaml run --rm api npm run migrate
docker compose -f compose.dev.yaml up -d --build api

docker compose -f compose.dev.yaml ps
```

## Normal branch validation

Only the development worktree changes branches. The regular checkout remains on its deployment branch.

To validate a branch:

```bash
cd ~/dev/guild-operations-stack-dev

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

Because the development API bind-mounts only `~/dev/guild-operations-stack-dev`, branch switching there affects only the development deployment.

## Stop and remove

Stop development containers while retaining their database:

```bash
cd ~/dev/guild-operations-stack-dev
docker compose -f compose.dev.yaml down
```

Destroy the development stack including its database and node-modules volumes only when a full reset is intended:

```bash
cd ~/dev/guild-operations-stack-dev
docker compose -f compose.dev.yaml down -v
```

`down -v` is destructive only to the `guild-operations-dev` Compose project's volumes. It is not part of normal branch switching or validation.
