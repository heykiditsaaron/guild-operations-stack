# BotGhost Integration Cheat Sheet

This document is the practical operator reference for what Guild Operations currently sends to BotGhost.

It is not the authoritative definition of publication meaning or current Guild Operations state. Publication catalogs live under `docs/publications/`; authoritative HTTP contracts live under `docs/endpoints/`; cross-cutting publication behavior lives in `docs/publication-model.md`.

BotGhost receives attention signals and concrete object coordinates. When current truth matters, BotGhost should query Guild Operations rather than treating webhook variables as durable state.

## BotGhost environment

BotGhost has its own runtime environment file:

```text
botghost.env
```

The tracked `botghost.env.example` documents the required variables:

```text
BOTGHOST_API_KEY=
BOTGHOST_GUILDIE_WEBHOOK_URL=
BOTGHOST_CHARACTER_WEBHOOK_URL=
BOTGHOST_RAFFLE_WEBHOOK_URL=
```

`BOTGHOST_API_KEY` belongs to the BotGhost integration as a whole. The webhook URLs identify the concrete BotGhost publication targets currently used by Guild Operations.

## Shared transport shape

Guild Operations currently sends BotGhost webhook payloads in this shape:

```json
{
  "variables": [
    {
      "name": "event_kind",
      "variable": "{event_kind}",
      "value": "..."
    }
  ]
}
```

Every current publication includes `{event_kind}`.

## Guildie publications

Transport target:

```text
BOTGHOST_GUILDIE_WEBHOOK_URL
```

| Publication | Variables available in BotGhost | Query afterward |
| --- | --- | --- |
| `guildie.discord.linked` | `{event_kind}`, `{guildie_id}`, `{discord_user_id}` | `GET /events/query/guildies/{guildie_id}` |
| `guildie.discord.unlinked` | `{event_kind}`, `{guildie_id}`, `{discord_user_id}` | `GET /events/query/guildies/{guildie_id}` |
| `guildie.main.changed` | `{event_kind}`, `{guildie_id}`, `{guild_id}` | `GET /events/query/guildies/{guildie_id}` |
| `guildie.joined` | `{event_kind}`, `{guildie_id}`, `{guild_id}` | `GET /events/query/guildies/{guildie_id}` |
| `guildie.left` | `{event_kind}`, `{guildie_id}`, `{guild_id}` | `GET /events/query/guildies/{guildie_id}` |
| `guildie.rank.changed` | `{event_kind}`, `{guildie_id}`, `{guild_id}` | `GET /events/query/guildies/{guildie_id}` |

`guildie_id` identifies the affected Guildie directly. There is no generic Subject transport coordinate.

For `guildie.discord.unlinked`, `{discord_user_id}` identifies the association that disappeared. The follow-up query should return no Discord association; the old Discord coordinate remains useful for removing a stale Discord-side projection.

## Character publications

Transport target:

```text
BOTGHOST_CHARACTER_WEBHOOK_URL
```

| Publication | Variables available in BotGhost | Query afterward |
| --- | --- | --- |
| `character.joined` | `{event_kind}`, `{guild_id}`, `{region}`, `{realm_id}`, `{character_id}` | `GET /events/query/guilds/{guild_id}/character-members/{region}/{realm_id}/{character_id}` |
| `character.left` | `{event_kind}`, `{guild_id}`, `{region}`, `{realm_id}`, `{character_id}` | `GET /events/query/guilds/{guild_id}/character-members/{region}/{realm_id}/{character_id}` |
| `character.rank.changed` | `{event_kind}`, `{guild_id}`, `{region}`, `{realm_id}`, `{character_id}` | `GET /events/query/guilds/{guild_id}/character-members/{region}/{realm_id}/{character_id}` |

Machine-query credential used for Guildie and Character follow-up requests:

```text
EVENT_QUERY_API_KEY=<secret>
```

Preferred request header:

```http
Authorization: Bearer <EVENT_QUERY_API_KEY>
```

## Raffle publications

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

Machine-query credential used for raffle follow-up requests:

```text
RAFFLE_QUERY_API_KEY=<secret>
```

## BotGhost operating rule

Use webhook variables to decide what changed and where to look. Use the matching Guild Operations endpoint to determine what is true now.

```text
BotGhost receives publication
        ↓
inspect {event_kind} and concrete coordinates
        ↓
query Guild Operations
        ↓
read current authoritative projection
        ↓
apply or remove BotGhost / Discord projection
```

This keeps BotGhost useful as the current subscriber surface without making BotGhost the owner of Guild Operations truth.
