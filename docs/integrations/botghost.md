# BotGhost Integration Cheat Sheet

This document is the practical operator reference for what Guild Operations currently sends to BotGhost.

It is not the authoritative definition of publication meaning or current Guild Operations state. Publication catalogs live under `docs/publications/`; authoritative HTTP contracts live under `docs/endpoints/`; cross-cutting publication behavior lives in `docs/publication-model.md`.

BotGhost receives attention signals and coordinates. When current truth matters, BotGhost should query Guild Operations rather than treating webhook variables as durable state.

## Shared transport shape

Guild Operations sends BotGhost webhook payloads in this shape:

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

`{event_kind}` is the current transport variable name used to carry the publication kind. Its implementation name does not make **Events** the owning domain category.

Every current publication includes `{event_kind}`.

The remaining variables depend on the publication.

## Subject publication webhook

Transport configuration:

```text
BOTGHOST_EVENTS_WEBHOOK_URL=<BotGhost webhook URL>
BOTGHOST_API_KEY=<BotGhost API key>
```

The webhook configuration name reflects the current implementation. The publications delivered through it are owned by Subject machinery.

### Subject variables

| Publication | Variables available in BotGhost | Query afterward |
| --- | --- | --- |
| `subject.discord.linked` | `{event_kind}`, `{subject_id}`, `{discord_user_id}` | `GET /events/query/subjects/{subject_id}` |
| `subject.discord.unlinked` | `{event_kind}`, `{subject_id}`, `{discord_user_id}` | `GET /events/query/subjects/{subject_id}` |
| `subject.main.changed` | `{event_kind}`, `{subject_id}`, `{guild_id}` | `GET /events/query/subjects/{subject_id}` |

Available variable names:

```text
{event_kind}
{subject_id}
{discord_user_id}
{guild_id}
```

`{discord_user_id}` exists only for Discord association publications.

`{guild_id}` exists only for `subject.main.changed` in the current publication catalog.

For `subject.discord.unlinked`, `{discord_user_id}` identifies the association that disappeared. The follow-up subject query should return no Discord association; the old Discord coordinate remains useful for removing a stale Discord-side projection.

Machine-query credential used for the follow-up request:

```text
EVENT_QUERY_API_KEY=<secret>
```

Preferred request header:

```http
Authorization: Bearer <EVENT_QUERY_API_KEY>
```

For the authoritative subject contract, see `docs/endpoints/subject.md`. For subject publication semantics, see `docs/publications/subject.md`.

## Raffle webhook

Transport configuration:

```text
BOTGHOST_RAFFLE_WEBHOOK_URL=<BotGhost webhook URL>
BOTGHOST_API_KEY=<BotGhost API key>
```

### Raffle variables

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

Available variable names:

```text
{event_kind}
{round_id}
{claim_id}
{winning_claim_id}
```

`{claim_id}` exists only for claim publications.

`{winning_claim_id}` exists only for `raffle.round.drawn`.

Machine-query credential used for raffle follow-up requests:

```text
RAFFLE_QUERY_API_KEY=<secret>
```

Preferred request header:

```http
Authorization: Bearer <RAFFLE_QUERY_API_KEY>
```

## BotGhost operating rule

Use webhook variables to decide what changed and where to look. Use the matching Guild Operations endpoint to determine what is true now.

```text
BotGhost receives publication
        ↓
inspect {event_kind} and coordinates
        ↓
query Guild Operations
        ↓
read current authoritative projection
        ↓
apply or remove BotGhost / Discord projection
```

This keeps BotGhost useful as the current subscriber surface without making BotGhost the owner of Guild Operations truth.
