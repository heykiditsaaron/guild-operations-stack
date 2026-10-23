# System Administration bootstrap (first milestone)

System Administration is an independent OCI container and is not part of the managed Guild Operations Compose project.

From the repository root, build and start it with:

```sh
docker compose -f compose.administration.yaml up -d --build
docker compose -f compose.administration.yaml ps
curl -fsS http://127.0.0.1:3103/health
```

Initialize the persistent installation identity through the Administration CLI:

```sh
docker compose -f compose.administration.yaml exec administration node dist/system-administration/cli.js initialize
docker compose -f compose.administration.yaml exec administration node dist/system-administration/cli.js status
```

To verify persistence, recreate the container (without removing its named volume) and check that the installation ID remains the same:

```sh
docker compose -f compose.administration.yaml up -d --force-recreate
docker compose -f compose.administration.yaml exec administration node dist/system-administration/cli.js status
```

The host port is intentionally bound only to 127.0.0.1. Remote browser access and a safe enrollment/credential delivery workflow are not yet implemented. The Administration CLI can be invoked locally through the container runtime. Never publish the existing Administration session endpoint to an untrusted network.

This bootstrap does not mount the Docker socket, execute deployment plans, provision PostgreSQL, or start the Guild Operations application. Those are subsequent milestones. The named volume is the sole persistent Administration state authority. Back up and restore it separately; do not use `down -v` unless intentionally deleting installation state.
