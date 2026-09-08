# BotGhost Integration Cheat Sheet

This document is the practical operator reference for the BotGhost integration.

## Current scope

Global Guildie and Character publication transport is currently removed. Guild Operations does not presently send those global publication classes to BotGhost.

Raffle owns its own BotGhost integration and remains separate from global publication machinery. Its authoritative machine-readable follow-up surface now participates in the promoted `/api/v1` REST namespace.

## REST read authority

Read-only REST requests use:

```text
API_READ_KEY=<secret>
```

Preferred request header:

```http
Authorization: Bearer <API_READ_KEY>
```

During the Raffle query migration, Raffle REST reads also accept `RAFFLE_QUERY_API_KEY` only when `API_READ_KEY` is not configured. New configuration should use `API_READ_KEY`.

Established global read resources include:

```http
GET /api/v1/guildies/{guildie_id}
GET /api/v1/guilds/{guild_id}/characters/{region}/{realm_id}/{character_id}
```

Established Raffle read resources include:

```http
GET /api/v1/raffle/rounds/live
GET /api/v1/raffle/rounds/{round_id}
GET /api/v1/raffle/claims/{claim_id}
```

These endpoints return current application state. They are not publication payloads and do not transfer authority to BotGhost.

## Raffle publications

Transport target:

```text
BOTGHOST_RAFFLE_WEBHOOK_URL
```

| Publication | Variables available in BotGhost | Read afterward |
| --- | --- | --- |
| `raffle.round.live` | `{event_kind}`, `{round_id}` | `GET /api/v1/raffle/rounds/{round_id}` or `GET /api/v1/raffle/rounds/live` |
| `raffle.claim.submitted` | `{event_kind}`, `{round_id}`, `{claim_id}` | `GET /api/v1/raffle/claims/{claim_id}` |
| `raffle.claim.approved` | `{event_kind}`, `{round_id}`, `{claim_id}` | `GET /api/v1/raffle/claims/{claim_id}` |
| `raffle.claim.denied` | `{event_kind}`, `{round_id}`, `{claim_id}` | `GET /api/v1/raffle/claims/{claim_id}` |
| `raffle.claim.cancelled` | `{event_kind}`, `{round_id}`, `{claim_id}` | `GET /api/v1/raffle/claims/{claim_id}` |
| `raffle.round.drawn` | `{event_kind}`, `{round_id}`, `{winning_claim_id}` | `GET /api/v1/raffle/rounds/{round_id}` and optionally `GET /api/v1/raffle/claims/{winning_claim_id}` |
| `raffle.round.cancelled` | `{event_kind}`, `{round_id}` | `GET /api/v1/raffle/rounds/{round_id}` |
| `raffle.round.no-entry-cancelled` | `{event_kind}`, `{round_id}` | `GET /api/v1/raffle/rounds/{round_id}` |

The legacy `/raffle/query/*` routes and `RAFFLE_QUERY_API_KEY` remain temporarily available only to avoid breaking an existing consumer during migration. They should not be used for new BotGhost work.

## Operating rule

Where an integration receives an attention signal, the signal should identify concrete domain coordinates. The integration should then read the owning Guild Operations contract to determine current truth rather than treating the signal itself as durable state.
