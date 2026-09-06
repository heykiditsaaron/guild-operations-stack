# Global API Endpoints

This document is the canonical HTTP reference for Guild Operations endpoints that belong to the application globally rather than to a specific module.

Module-owned endpoints are documented with their owning module and are intentionally not duplicated here. In particular, raffle endpoints remain documented in `docs/endpoints/raffle.md`.

Web presentation routes under `src/web/**` are also outside this reference. This document covers the machine-readable endpoints and browser ceremonies that constitute the global application API surface.

## Authority classes

Global endpoints currently use four authority contexts:

- **Public** — no application authority is required.
- **Application session** — requires a valid `guild_session` cookie resolving to a current Guildie.
- **Application session plus capability** — requires a valid session and an explicit Guild Operations capability derived from current guild authority.
- **Machine query authority** — requires the read-only `EVENT_QUERY_API_KEY` credential.

Machine query authority grants no human operation authority. It exists so external subscribers can query current authoritative Guild Operations state without acquiring a human session.

## Service

### GET `/health`

Public health endpoint.

The endpoint verifies database connectivity before returning success.

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

The endpoint creates a short-lived authentication attempt and redirects the browser to Blizzard authorization.

An unsupported region returns `400` with `unsupported_region`.

### GET `/auth/blizzard/callback`

Consumes the Blizzard OAuth callback.

The callback validates and consumes the short-lived authentication attempt, exchanges the authorization code, acquires Blizzard account authority, establishes or resolves the Guildie, creates the application session, and redirects to the requested application destination.

OAuth callback query values are ceremony inputs and must not be treated as durable application state.

### POST `/auth/logout`

Revokes the current application session when one is present, clears the `guild_session` cookie, and returns `204`.

The endpoint is idempotent from the caller's perspective: an absent session token does not prevent logout completion.

## Current member

### GET `/me`

Requires an application session.

Returns the current authenticated Guildie's self projection, including controlled current guild Characters and selected-main presentation.

```json
{
  "guildie_id": "0127694c-d28b-49eb-83ee-a190d313901f",
  "region": "us",
  "character_count": 2,
  "guild": {
    "guild_id": "65431436",
    "main_character": null,
    "characters": []
  }
}
```

The selected main is presentation preference. It does not establish identity or authorization.

### GET `/me/refresh`

Requires an application session and current guild membership.

Begins the authenticated self-account refresh ceremony. The existing Guildie must remain the Blizzard principal demonstrated by the refresh ceremony; refresh cannot move the session to a different Guildie.

Optional query parameter:

- `return_to` — safe application-relative path. Defaults to `/`.

The endpoint redirects to Blizzard authorization. On callback, authoritative account control is reconciled and eligible current guild Characters are reacquired for presentation data.

### PUT `/me/main-character`

Requires an application session.

Selects the authenticated Guildie's main Character for presentation.

Request body:

```json
{
  "realm_id": "11",
  "character_id": "123456789"
}
```

The Character must currently be eligible for the configured guild. Invalid coordinates return `400`; a Character that is not currently eligible returns `409` with `character_not_currently_eligible`.

### GET `/me/discord/connect`

Requires an application session.

Begins the optional Discord association ceremony for the existing Guildie and redirects the browser to Discord authorization.

Optional query parameter:

- `return_to` — safe application-relative path. Defaults to `/`.

Discord association resolves to the existing Guildie. Discord does not create the canonical member.

### GET `/auth/discord/callback`

Consumes the Discord OAuth callback for an existing association attempt.

The callback requires that the active application session still resolves to the Guildie that began the ceremony. Successful acquisition establishes the Discord association or confirms the existing matching association, then redirects back to the application.

Association conflicts redirect with a `discord=conflict` result rather than reassociating an existing Discord identity or Guildie implicitly.

### POST `/me/discord/disconnect`

Requires an application session.

Removes the authenticated Guildie's Discord association, publishes `guildie.discord.unlinked` when an association actually existed, and redirects to the requested application-relative destination.

Optional query parameter:

- `return_to` — safe application-relative path. Defaults to `/`.

## Guild operations

### POST `/guild/refresh`

Requires an application session plus the guild refresh capability.

Refreshes configured-guild authority from Blizzard and performs the associated Character reconciliation.

The response reports the refreshed guild, roster size, requesting Guildie and effective rank, and reconciliation results.

```json
{
  "guild_id": "65431436",
  "roster_count": 42,
  "requested_by": {
    "guildie_id": "0127694c-d28b-49eb-83ee-a190d313901f",
    "effective_rank": 2
  },
  "reconciliation": {
    "characters_targeted": 10,
    "profiles_updated": 10,
    "media_updated": 10,
    "failed_profiles": 0,
    "failed_media": 0,
    "api_calls": 20
  }
}
```

Missing session authority returns `401`. A current Guildie without the required capability receives `403` with `guild_capability_required` and the required capability coordinate.

## Machine queries

These endpoints require `EVENT_QUERY_API_KEY`. The credential may be supplied either directly as the `Authorization` header value or as a Bearer token.

### GET `/query/guildies/:guildieId`

Returns the current Guildie projection for one durable `guildie_id`.

The response includes the current Discord association, selected-main projection, and current organizational membership. Current organizational membership is either present with effective rank or `null`.

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

A `null` membership does not mean the Guildie was deleted or closed. It means the Guildie currently controls no Character present on the Blizzard Character roster and therefore has no current guild participation surface or rank-derived authority.

Effective rank is the highest-authority rank among currently controlled roster Characters. Selected main remains presentation preference, not identity or authorization.

### GET `/query/guilds/:guildId/character-members/:region/:realmId/:characterId`

Returns current authoritative roster truth for exactly one Blizzard Character coordinate.

When the Character is not currently on the roster, the coordinate remains a valid query and `membership` is `null`. This allows a `character.left` publication to identify the affected Character while the query establishes its current absence.

A guild coordinate other than the configured guild returns `404`. Invalid Character membership coordinates return `400`.

## Subscriber usage

```text
receive publication
    ↓
read concrete object coordinates
    ↓
query Guild Operations
    ↓
observe current authoritative state
    ↓
converge local projection
```

Publications and query endpoints name actual domain objects. They do not use a generic Subject coordinate.
