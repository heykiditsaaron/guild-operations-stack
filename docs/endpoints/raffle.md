# Raffle Endpoints

This document is the canonical HTTP endpoint reference for the Guild Operations Raffle module.

Raffle owns its domain, application operations, query contracts, browser/application routes, and module-owned REST resources. The promoted REST namespace is `/api/v1`; REST serializes established Raffle application/query contracts rather than defining a second model.

## Authority classes

### Member session

A signed-in Guildie authenticated by the normal application session cookie.

Member session authority is used for member-owned Raffle participation and browser-facing authenticated reads. Participation authority is established by Raffle rules such as current Character control, current guild membership, round lifecycle, claim ownership, and the claim-admission window rather than by an operator capability.

### Raffle operation capabilities

Privileged Raffle operations use the global Guild Operations capability system. Raffle contributes the capability definitions and the application operation enforces the exact capability required:

- `raffle.modify` — create rounds and change mutable persisted round definition;
- `raffle.stage` — move rounds through operator-controlled stages, including activation and cancellation;
- `raffle.claims` — inspect the operational claim ledger and adjudicate claims;
- `raffle.draw` — perform the manual draw.

Guild Master rank 0 and the configured environment operator override are inherently permitted by the global capability machinery. Configurable rank grants are owned by the global Permissions system; Raffle does not maintain a separate `raffle.admin` authority.

An aggregate "can operate Raffle" check may be used to decide whether to present the Raffle operations surface. It is not mutation authority and does not grant one Raffle capability from possession of another.

### REST read authority

Raffle REST reads use the global read credential:

```http
Authorization: Bearer <API_READ_KEY>
```

REST read authority grants no Raffle mutation or human operation authority.

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

The Raffle REST surface is currently intentionally read-only. Existing raffle mutations require legitimate human/member authority: precise operator capabilities for privileged operations, or participant identity/ownership for member actions. `API_WRITE_KEY` does not create a Guildie session, claim ownership, or human judgment authority, so Raffle does not expose machine mutations merely because the underlying application operation exists.

A future external mutation surface must carry legitimate actor authority into the existing Raffle application operations rather than bypassing them.

### Round representation

Raffle REST round resources use snake-case transport naming while preserving established Raffle meanings:

```json
{
  "round_id": "...",
  "title": "September Raffle",
  "status": "concluded",
  "conclusion": "drawn",
  "drawing_at_unix": 1788901200,
  "entry_price_gold": "1000",
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

Only approved claims contribute to `approved_entries`, the gold pot, and the drawing population. Entries are derived equal-weight positions used for winner selection; they are not persisted or exposed as independent records.

### GET `/api/v1/raffle/rounds/live`

Requires REST read authority. Returns the currently live raffle in a wrapper; when there is no live raffle, `round` is `null`.

### GET `/api/v1/raffle/rounds/:roundId`

Requires REST read authority. Returns one authoritative Raffle round representation. Unknown coordinates return `404 round_not_found`.

### GET `/api/v1/raffle/claims/:claimId`

Requires REST read authority. Returns one authoritative claim projection. The REST claim projection intentionally omits claimant Guildie IDs and resolution-actor Guildie IDs. External readers receive the Raffle fact and useful WoW recognition coordinates, not unrelated member authority. Unknown claim coordinates return `404 claim_not_found`.

## Authenticated Raffle reads

These routes support Guild Operations browser/application interactions. They are not the preferred machine interface.

### GET `/raffle/rounds/:roundId`

Authority: member session.

Returns the domain round object. Unknown rounds return `404 round_not_found`.

### GET `/raffle/rounds/:roundId/claims`

Authority: member session plus `raffle.claims`.

Returns the full operational claim ledger. This route is an operational read, so it uses the claim-adjudication capability rather than a broad Raffle operator gate.

## Round operations

These are authenticated application operations and remain the mutation surface for current web/operation interactions.

### POST `/raffle/rounds`

Authority: `raffle.modify`.

Creates a listed round.

```json
{
  "round_title": "September Raffle",
  "drawing_at_unix": 1788901200,
  "entry_price_gold": 1000,
  "prize_kind": "gold",
  "winner_percentage": 50,
  "prize_description": null
}
```

For item/other prizes, `winner_percentage` must be `null` and `prize_description` must be non-empty descriptive text.

Returns `201` with the established round. The current shared event-publication compatibility projection is synchronized in the same transaction.

### PATCH `/raffle/rounds/:roundId`

Authority: `raffle.modify`.

Updates terms of a listed round. Terms are locked after activation. The current event-publication projection updates in the same transaction.

### POST `/raffle/rounds/:roundId/live`

Authority: `raffle.stage`.

Transitions a listed raffle to `live`. The guild may have at most one live raffle; conflict returns `409 active_round_exists`.

### POST `/raffle/rounds/:roundId/cancel`

Authority: `raffle.stage`.

Concludes a listed or live round with `conclusion = operator_cancelled`. Existing claims and evidence remain preserved. Cancellation withdraws the current shared event-publication projection without deleting Raffle truth.

### POST `/raffle/rounds/:roundId/draw`

Authority: `raffle.draw`.

Resolves a live raffle. Drawing is refused while unresolved claims exist. The selection population is derived from approved claims. If non-empty, conclusion is `drawn`; if empty, conclusion is `no_participation`.

Claims are durable participation records. Drawing entries are ephemeral selection weight derived from approved claims and are not persisted as independent records.

## Claim operations

### POST `/raffle/rounds/:roundId/claims`

Authority: member session plus Raffle participation rules.

Submits a claim for a currently controlled Character on the current guild roster.

```json
{
  "realm_id": "...",
  "character_id": "...",
  "entry_count": 5
}
```

`entry_count` is the number of equal drawing positions the claim will contribute if approved. The durable object is the claim; entries are derived selection weight rather than independent records.

Returns `201` with the established claim.

### POST `/raffle/claims/:claimId/cancel`

Authority: member session; claim ownership is enforced by Raffle.

Cancels the caller's own unresolved claim. Returns `204`. Approved claims cannot be withdrawn.

### POST `/raffle/claims/:claimId/approve`

Authority: `raffle.claims`.

Records the human attendant judgment that the promised guild-bank deposit was fulfilled. Returns `204`.

### POST `/raffle/claims/:claimId/deny`

Authority: `raffle.claims`.

Records a human attendant denial of an unresolved claim.

```json
{ "reason": "Required reason" }
```

Returns `204`.

## Time values

All Raffle HTTP and persisted operational instants use Unix seconds. Human-readable time and timezone are presentation concerns.
