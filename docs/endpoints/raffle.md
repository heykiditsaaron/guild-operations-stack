# Raffle Endpoints

This document is the canonical HTTP endpoint reference for the Guild Operations raffle module.

Raffle owns its domain, application operations, query contracts, browser/application routes, and module-owned REST resources. The promoted REST namespace is `/api/v1`; REST serializes established Raffle application/query contracts rather than defining a second model.

## Authority classes

### Member session

A signed-in Guildie authenticated by the normal application session cookie.

Member session authority is used for member-owned raffle participation and browser-facing authenticated reads.

### `raffle.admin`

A signed-in Guildie whose current guild authority satisfies the Raffle module's administration policy.

Raffle owns this policy. It currently derives administration authority from effective Blizzard guild rank indexes `0`, `1`, and `2`.

This authority is required for raffle preparation, activation, adjudication, drawing, administrative cancellation, and claim-ledger inspection.

### REST read authority

Raffle REST reads use the global read credential:

```http
Authorization: Bearer <API_READ_KEY>
```

REST read authority grants no raffle mutation or human operation authority.

## Raffle lifecycle

A raffle round exposes lifecycle and conclusion separately.

`status` is one of:

- `listed`
- `live`
- `concluded`

`conclusion` is `null` until conclusion, then one of:

- `drawn`
- `operator_cancelled`
- `no_participation`

Creation establishes a `listed` round; `created` is not a lifecycle state.

## Versioned REST API

The Raffle REST surface is currently intentionally read-only. Existing raffle mutations require human/member authority such as `raffle.admin` or claim ownership. `API_WRITE_KEY` does not create a Guildie session, claim ownership, or human judgment authority, so Raffle does not currently expose machine mutations merely because the underlying application operation exists.

A future external mutation surface must carry legitimate actor authority into the existing Raffle application operations rather than bypassing it.

### Round representation

Raffle REST round resources use snake-case transport naming while preserving established Raffle meanings:

```json
{
  "round_id": "...",
  "title": "September Raffle",
  "status": "concluded",
  "conclusion": "drawn",
  "drawing_at_unix": 1788901200,
  "ticket_price_gold": "1000",
  "prize": {
    "kind": "gold",
    "winner_percentage": 50,
    "description": null
  },
  "created_at_unix": 1788800000,
  "live_at_unix": 1788810000,
  "concluded_at_unix": 1788901300,
  "claims": {
    "pending": 0,
    "approved": 2,
    "denied": 1,
    "cancelled": 0,
    "approved_entries": 5
  },
  "gold": {
    "pot": "5000",
    "winner_prize": "2500",
    "guild_share": "2500"
  },
  "total_entries": 5,
  "winning_claim_id": "...",
  "winner": {
    "claim_id": "...",
    "character": {
      "character_id": "...",
      "name": "Character",
      "realm_id": "...",
      "realm_name": "Realm",
      "realm_slug": "realm"
    }
  }
}
```

For item and other prizes, `winner_percentage` is `null`, `description` contains the descriptive prize, and `gold` is `null`.

Only approved claims contribute to `approved_entries`, the gold pot, and draw population. Individual tickets are not persisted or exposed as independent records; approved entry count is derived from approved claims.

### GET `/api/v1/raffle/rounds/live`

Requires REST read authority.

Returns the currently live raffle in a wrapper:

```json
{
  "round": { "...": "round representation" }
}
```

When there is no live raffle:

```json
{ "round": null }
```

### GET `/api/v1/raffle/rounds/:roundId`

Requires REST read authority.

Returns one authoritative Raffle round representation. Unknown coordinates return:

```json
{ "error": "round_not_found" }
```

with HTTP `404`.

### GET `/api/v1/raffle/claims/:claimId`

Requires REST read authority.

Returns one authoritative claim projection:

```json
{
  "claim_id": "...",
  "round_id": "...",
  "round": {
    "status": "live",
    "conclusion": null
  },
  "character": {
    "character_id": "...",
    "name": "Character",
    "realm_id": "...",
    "realm_name": "Realm",
    "realm_slug": "realm"
  },
  "requested_entry_count": 5,
  "promised_gold_value": "5000",
  "created_at_unix": 1788800000,
  "resolution": {
    "kind": "approved",
    "at_unix": 1788800300,
    "denial_reason": null
  }
}
```

`resolution.kind` is `approved`, `denied`, `cancelled`, or `null` while unresolved.

The REST claim projection intentionally omits claimant Guildie IDs and resolution-actor Guildie IDs. External readers receive the Raffle fact and useful WoW recognition coordinates, not unrelated member authority.

Unknown claim coordinates return `404 claim_not_found`.

## Authenticated raffle reads

These routes support Guild Operations browser/application interactions. They are not the preferred machine interface.

### GET `/raffle/rounds/:roundId`

Authority: member session.

Returns the domain round object. Unknown rounds return `404 round_not_found`.

### GET `/raffle/rounds/:roundId/claims`

Authority: member session plus `raffle.admin`.

Returns the full administrative claim ledger:

```json
{
  "round_id": "...",
  "claims": []
}
```

## Round operations

These are authenticated application operations and remain the mutation surface for current web/admin interactions.

### POST `/raffle/rounds`

Authority: `raffle.admin`.

Creates a listed round.

```json
{
  "round_title": "September Raffle",
  "drawing_at_unix": 1788901200,
  "ticket_price_gold": 1000,
  "prize_kind": "gold",
  "winner_percentage": 50,
  "prize_description": null
}
```

For item/other prizes, `winner_percentage` must be `null` and `prize_description` must be non-empty descriptive text.

Returns `201` with the established round. Raffle and its Guild Calendar listing are established in the same transaction.

### PATCH `/raffle/rounds/:roundId`

Authority: `raffle.admin`.

Updates terms of a listed round. Terms are locked after activation. Calendar projection updates in the same transaction.

### POST `/raffle/rounds/:roundId/live`

Authority: `raffle.admin`.

Transitions a listed raffle to `live`. The guild may have at most one live raffle; conflict returns `409 active_round_exists`.

### POST `/raffle/rounds/:roundId/cancel`

Authority: `raffle.admin`.

Concludes a listed or live round with `conclusion = operator_cancelled`. Existing claims and evidence remain preserved.

### POST `/raffle/rounds/:roundId/draw`

Authority: `raffle.admin`.

Resolves a live raffle. Drawing is refused while unresolved claims exist.

The selection population is derived from approved claims. If non-empty, conclusion is `drawn`; if empty, conclusion is `no_participation`.

Claims are durable participation records. Drawing entries are ephemeral selection weight derived from approved claims and are not persisted as independent ticket records.

## Claim operations

### POST `/raffle/rounds/:roundId/claims`

Authority: member session.

Submits a claim for a currently controlled Character on the current guild roster.

```json
{
  "realm_id": "...",
  "character_id": "...",
  "ticket_count": 5
}
```

The historical application input name `ticket_count` represents requested draw-entry count. The durable object is the claim, not individual ticket records.

Returns `201` with the established claim.

### POST `/raffle/claims/:claimId/cancel`

Authority: member session; claim ownership is enforced by Raffle.

Cancels the caller's own unresolved claim. Returns `204`. Approved claims cannot be withdrawn.

### POST `/raffle/claims/:claimId/approve`

Authority: `raffle.admin`.

Records the human attendant judgment that the promised guild-bank deposit was fulfilled. Returns `204`.

### POST `/raffle/claims/:claimId/deny`

Authority: `raffle.admin`.

Records a human attendant denial of an unresolved claim.

```json
{ "reason": "Required reason" }
```

Returns `204`.

## Time values

All Raffle HTTP and persisted operational instants use Unix seconds. Human-readable time and timezone are presentation concerns.
