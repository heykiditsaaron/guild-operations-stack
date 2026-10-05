# Global API Endpoints

This document is the canonical HTTP reference for Guild Operations endpoints that belong to the application globally rather than to a specific module.

Module-owned endpoints are documented with their owning module and are intentionally not duplicated here. In particular, raffle endpoints remain documented in `docs/endpoints/raffle.md`.

Web presentation routes under `src/web/**` are also outside this reference.

## Interface classes

Guild Operations currently exposes two kinds of global HTTP interface:

- **Application/browser interfaces** — authentication ceremonies, current-member interactions, and administrative operations used by the Guild Operations web application.
- **Versioned REST interface** — machine-readable external access under `/api/v1`.

The REST interface is an adapter over established application contracts. It does not define a second model of Guild Operations state.

## Authority classes

Global endpoints currently use five authority contexts:

- **Public** — no application authority is required.
- **Application session** — requires a valid `guild_session` cookie resolving to a current Guildie.
- **Application session plus capability** — requires a valid session and an explicit Guild Operations capability derived from current guild authority.
- **REST read authority** — requires the read-only `API_READ_KEY` credential.

REST read authority grants no mutation or human operation authority.

## Service

### GET `/health`

Public health endpoint. It verifies database connectivity before returning success.

```json
{
  "status": "ok"
}
```

## Blizzard authentication and application session

### GET `/auth/blizzard/start`

Begins the Blizzard authentication ceremony.

Optional query parameters:

- `region` — Blizzard region. Defaults to `us`.
- `return_to` — safe application-relative path to return to after successful authentication.

### GET `/auth/blizzard/callback`

Consumes the Blizzard OAuth callback, establishes or resolves the Guildie, creates the application session, and redirects to the requested application destination.

OAuth callback query values are ceremony inputs and must not be treated as durable application state.

### POST `/auth/logout`

Revokes the current application session when one is present, clears the `guild_session` cookie, and returns `204`.

## Current member

### GET `/me/refresh`

Requires an application session and current guild membership. Begins the authenticated self-account refresh ceremony.

### PUT `/me/main-character`

Requires an application session. Selects the authenticated Guildie's main Character for presentation.

```json
{
  "realm_id": "11",
  "character_id": "123456789"
}
```

The Character must currently be eligible for the configured guild.

### GET `/me/discord/connect`

Requires an application session. Begins the optional Discord association ceremony for the existing Guildie.

### GET `/auth/discord/callback`

Consumes the Discord OAuth callback for an existing association attempt.

### POST `/me/discord/disconnect`

Requires an application session. Removes the authenticated Guildie's Discord association.

## Guild operations

### POST `/guild/refresh`

Requires an application session plus the guild refresh capability. Refreshes configured-guild authority from Blizzard and performs the associated Character reconciliation.

### PUT `/guild/refresh/schedule`

Requires an application session plus the `guild.refresh` capability. Configures the application-owned automatic guild refresh cadence.

```json
{
  "enabled": true,
  "interval_seconds": 86400
}
```

`interval_seconds` must be an integer of at least `300` seconds.

## Versioned REST API

`/api/v1` is the promoted global REST namespace. Resources and operations are added only when an established application contract has a concrete external-consumer need.

Read operations require:

```http
Authorization: Bearer <API_READ_KEY>
```

### GET `/api/v1/guildies/:guildieId`

Returns the current Guildie application representation for one durable `guildie_id`.

```json
{
  "guildie_id": "0127694c-d28b-49eb-83ee-a190d313901f",
  "discord": null,
  "guild": {
    "membership": {
      "guild_id": "65431436",
      "rank": 2,
      "rank_name": "Rank 2"
    },
    "main_character": null
  }
}
```

A `null` membership means the Guildie currently has no effective current guild participation/rank authority. It does not mean the durable Guildie was deleted.

Effective rank derives from currently controlled Characters on the Blizzard roster. Selected main remains presentation preference, not identity or authorization.

### GET `/api/v1/guilds/:guildId/characters/:region/:realmId/:characterId`

Returns the configured guild's current roster observation for exactly one Character coordinate.

When the Character is not currently on the roster, the coordinate remains a valid request and `membership` is `null`.

A guild coordinate other than the configured guild returns `404`. Invalid Character coordinates return `400`.

The route addresses the Character directly. It does not introduce a second `character-member` or `character-membership` domain object; `membership` is the current Blizzard-roster relationship projected for that Character.

## Guild Calendar

Calendar is internal temporal-map machinery. It persists the temporal coordinates of authoritative application subjects and the source/subject reference needed to query their owning module for projection guidance.

Calendar does not currently expose a standalone REST resource or generic point-insertion API. Generic calendar-native points, if needed, belong to a separately earned module rather than the shared temporal map itself.

## Legacy machine-query surface

The former global `/query/*` routes are retired. They were an earlier machine-query interface and are superseded by `/api/v1`.

This retirement applies only to global query routes. Module-owned machine interfaces, including raffle query routes, remain under their owning module until that module is separately reviewed.
