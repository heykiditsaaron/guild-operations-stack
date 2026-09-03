# Raffle Endpoints

This document is the canonical HTTP endpoint reference for the Guild Operations raffle feature.

It describes raffle query and operation surfaces only. It does not define Discord behavior, BotGhost commands, raffle UI presentation, or generic application API conventions.

## Authority classes

Raffle endpoints use three distinct authority classes.

### Member session

A signed-in Guild Operations subject authenticated by the normal application session cookie.

Member session authority is used for member-owned raffle participation and for browser-facing authenticated reads.

### `raffle.admin`

A signed-in subject whose current guild authority resolves to the `raffle.admin` capability.

This authority is required for raffle preparation, activation, adjudication, drawing, administrative cancellation, and claim-ledger inspection.

### Raffle machine query authority

A read-only machine credential configured as:

```text
RAFFLE_QUERY_API_KEY=<secret>
```

Machine query requests send:

```http
Authorization: Bearer <RAFFLE_QUERY_API_KEY>
```

This credential grants no raffle operation authority. It exists so external systems that receive authoritative raffle coordinates can ask Guild Operations for the current authoritative raffle projection without acquiring a human session or `raffle.admin` capability.

If the credential is not configured, machine query routes return `503 raffle_query_not_configured`. Missing or incorrect credentials return `401 raffle_query_authority_required`.

## Machine query endpoints

These endpoints are the preferred read surface for non-browser systems.

### GET `/raffle/query/live`

Returns the currently live raffle, or `null` when there is no live raffle.

Authority: raffle machine query authority.

Response:

```json
{
  "round": {
    "roundId": "...",
    "status": "live",
    "drawingAtUnix": 0,
    "ticketPriceGold": "1000",
    "prizeKind": "gold",
    "winnerPercentage": 50,
    "createdAtUnix": 0,
    "liveAtUnix": 0,
    "concludedAtUnix": null,
    "claims": {
      "pending": 1,
      "approved": 2,
      "denied": 0,
      "cancelled": 0,
      "approvedTickets": 5
    },
    "gold": {
      "pot": "5000",
      "winnerPrize": "2500",
      "guildShare": "2500"
    },
    "totalEntries": null,
    "winningClaimId": null,
    "winner": null
  }
}
```

No live raffle:

```json
{ "round": null }
```

Only approved claims contribute to `approvedTickets`, `gold.pot`, `gold.winnerPrize`, and `gold.guildShare`.

### GET `/raffle/query/rounds/:roundId`

Returns the authoritative projection of one raffle round identified by a published or otherwise known `roundId`.

Authority: raffle machine query authority.

Success:

```json
{ "round": { "...": "same round projection as /raffle/query/live" } }
```

Not found:

```json
{ "error": "round_not_found" }
```

A drawn round may additionally contain:

```json
{
  "winningClaimId": "...",
  "winner": {
    "claimId": "...",
    "characterName": "Character",
    "realmId": "...",
    "realmName": "Realm",
    "realmSlug": "realm"
  }
}
```

### GET `/raffle/query/claims/:claimId`

Returns the authoritative projection of one raffle claim identified by a published or otherwise known `claimId`.

Authority: raffle machine query authority.

Response:

```json
{
  "claim": {
    "claimId": "...",
    "roundId": "...",
    "roundStatus": "live",
    "character": {
      "characterId": "...",
      "name": "Character",
      "realmId": "...",
      "realmName": "Realm",
      "realmSlug": "realm"
    },
    "requestedTicketCount": 5,
    "promisedGoldValue": "5000",
    "createdAtUnix": 0,
    "resolution": {
      "kind": "approved",
      "atUnix": 0,
      "denialReason": null
    }
  }
}
```

`resolution.kind` is one of `approved`, `denied`, `cancelled`, or `null` while unresolved.

Not found:

```json
{ "error": "claim_not_found" }
```

The machine claim projection intentionally omits canonical subject IDs and attendant subject IDs. External consumers receive the raffle fact and useful WoW recognition coordinates, not unrelated identity authority.

## Authenticated raffle reads

These routes primarily support Guild Operations browser/application interactions. They are not the preferred machine query surface.

### GET `/raffle/rounds/:roundId`

Returns the domain round object for an authenticated subject.

Authority: member session.

Not found:

```json
{ "error": "round_not_found" }
```

### GET `/raffle/rounds/:roundId/claims`

Returns every claim for the specified round.

Authority: member session plus `raffle.admin`.

Response:

```json
{
  "round_id": "...",
  "claims": []
}
```

This is an administrative claim-ledger read. It must not be exposed merely because an external system knows a round ID.

## Round operations

### POST `/raffle/rounds`

Creates a prepared raffle round. Creation does not make the raffle live and does not publish a raffle operational event.

Authority: `raffle.admin`.

Body:

```json
{
  "drawing_at_unix": 0,
  "ticket_price_gold": 1000,
  "prize_kind": "gold",
  "winner_percentage": 50
}
```

Success: `201` with the created round.

### PATCH `/raffle/rounds/:roundId`

Updates terms of a prepared round. Terms are locked once the round becomes live.

Authority: `raffle.admin`.

Body: same terms shape as round creation.

### POST `/raffle/rounds/:roundId/live`

Makes a prepared raffle live.

Authority: `raffle.admin`.

The guild may have at most one live raffle. A conflicting activation returns `409 active_round_exists`.

Successful activation establishes authoritative raffle reality and publishes:

```text
raffle.round.live
roundId
```

### POST `/raffle/rounds/:roundId/cancel`

Administratively cancels a created or live round while preserving it and its claims as raffle history.

Authority: `raffle.admin`.

Successful cancellation publishes:

```text
raffle.round.cancelled
roundId
```

### POST `/raffle/rounds/:roundId/draw`

Manually concludes a live raffle.

Authority: `raffle.admin`.

Drawing refuses to proceed while unresolved claims exist.

If approved entries exist, successful conclusion publishes:

```text
raffle.round.drawn
roundId
winningClaimId
```

If no entries exist, successful conclusion establishes `no_entry_cancelled` and publishes:

```text
raffle.round.no-entry-cancelled
roundId
```

## Claim operations

### POST `/raffle/rounds/:roundId/claims`

Submits a member-authored raffle claim for a currently controlled character on the current guild roster.

Authority: member session.

Body:

```json
{
  "realm_id": "...",
  "character_id": "...",
  "ticket_count": 5
}
```

Success: `201` with the established claim.

Successful establishment publishes:

```text
raffle.claim.submitted
roundId
claimId
```

A rejected submission does not create a claim and therefore does not publish a raffle operational event.

### POST `/raffle/claims/:claimId/cancel`

Cancels the caller's own unresolved claim while its round is live.

Authority: member session; claim ownership is enforced by the domain.

Success: `204`.

Successful cancellation publishes:

```text
raffle.claim.cancelled
roundId
claimId
```

### POST `/raffle/claims/:claimId/approve`

Records an attendant judgment that the claim's promised guild-bank deposit was fulfilled.

Authority: `raffle.admin`.

Success: `204`.

Successful approval publishes:

```text
raffle.claim.approved
roundId
claimId
```

### POST `/raffle/claims/:claimId/deny`

Records an attendant judgment denying an unresolved claim.

Authority: `raffle.admin`.

Body:

```json
{ "reason": "Required reason" }
```

Success: `204`.

Successful denial publishes:

```text
raffle.claim.denied
roundId
claimId
```

## Published coordinates and follow-up queries

Published raffle events deliberately carry coordinates rather than flattened raffle state. The matching machine query is:

| Published event | Coordinates | Follow-up query |
| --- | --- | --- |
| `raffle.round.live` | `roundId` | `GET /raffle/query/rounds/:roundId` or `/raffle/query/live` |
| `raffle.claim.submitted` | `roundId`, `claimId` | `GET /raffle/query/claims/:claimId` |
| `raffle.claim.approved` | `roundId`, `claimId` | `GET /raffle/query/claims/:claimId` |
| `raffle.claim.denied` | `roundId`, `claimId` | `GET /raffle/query/claims/:claimId` |
| `raffle.claim.cancelled` | `roundId`, `claimId` | `GET /raffle/query/claims/:claimId` |
| `raffle.round.drawn` | `roundId`, `winningClaimId` | `GET /raffle/query/rounds/:roundId` and optionally `GET /raffle/query/claims/:winningClaimId` |
| `raffle.round.cancelled` | `roundId` | `GET /raffle/query/rounds/:roundId` |
| `raffle.round.no-entry-cancelled` | `roundId` | `GET /raffle/query/rounds/:roundId` |

The publisher says that meaningful raffle reality changed. These query endpoints answer what the authoritative raffle reality is now.

## Time values

All HTTP time values that represent operational instants use Unix seconds. Consumers decide how to express those instants to humans in the viewer's local timezone.

`datetime-local` is a browser input concern only and is converted to a timezone-neutral instant before a raffle operation crosses the backend boundary.
