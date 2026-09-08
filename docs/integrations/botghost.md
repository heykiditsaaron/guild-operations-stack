# BotGhost Integration Cheat Sheet

This document is the practical operator reference for the BotGhost integration.

## Current scope

Global Guildie and Character publication transport is currently removed. Guild Operations does not presently send those global publication classes to BotGhost.

Raffle owns its own BotGhost integration and remains separate from the global REST work described here.

If a global subscriber is introduced again, it should read current Guild Operations state through `/api/v1` rather than revive the former `/query/*` interface.

## Global REST follow-up surface

Read-only global REST requests use:

```text
API_READ_KEY=<secret>
```

Preferred request header:

```http
Authorization: Bearer <API_READ_KEY>
```

Established global read resources currently include:

```http
GET /api/v1/guildies/{guildie_id}
GET /api/v1/guilds/{guild_id}/character-memberships/{region}/{realm_id}/{character_id}
```

These endpoints return current application state. They are not publication payloads and do not transfer authority to BotGhost.

## Raffle publications

Raffle remains module-owned and is intentionally not migrated by the global REST work.

Transport target:

```text
BOTGHOST_RAFFLE_WEBHOOK_URL
```

| Publication | Variables available in BotGhost | Query afterward |
| --- | --- | --- |
| `raffle.round.live` | `{event_kind}`, `{round_id}` | `GET /raffle/query/rounds/{round_id}` or `GET /raffle/query/live` |
| `raffle.claim.submitted` | `{event_kind}`, `{round_id}`, `{claim_id}` | `GET /raffle/query/claims/{claim_id}` |
| `raffle.claim.approved` | `{event_kind}`, `{round_id}`, `{claim_id}` | `GET /raffle/query/claims/{claim_id}` |
| `raffle.claim.denied` | `{event_kind}`, `{round_id}`, `{claim_id}` | `GET /raffle/query/claims/{claim_id}` |
| `raffle.claim.cancelled` | `{event_kind}`, `{round_id}`, `{claim_id}` | `GET /raffle/query/claims/{claim_id}` |
| `raffle.round.drawn` | `{event_kind}`, `{round_id}`, `{winning_claim_id}` | `GET /raffle/query/rounds/{round_id}` and optionally `GET /raffle/query/claims/{winning_claim_id}` |
| `raffle.round.cancelled` | `{event_kind}`, `{round_id}` | `GET /raffle/query/rounds/{round_id}` |
| `raffle.round.no-entry-cancelled` | `{event_kind}`, `{round_id}` | `GET /raffle/query/rounds/{round_id}` |

Raffle machine-query authority remains:

```text
RAFFLE_QUERY_API_KEY=<secret>
```

## Operating rule

Where an integration receives an attention signal, the signal should identify concrete domain coordinates. The integration should then read the owning Guild Operations contract to determine current truth rather than treating the signal itself as durable state.
