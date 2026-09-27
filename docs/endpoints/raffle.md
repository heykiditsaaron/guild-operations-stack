# Raffle Endpoints

This document is the canonical HTTP endpoint reference for the Guild Operations Raffle Activity plugin.

Raffle owns its domain truth and application operations. Browser/application routes and the promoted REST adapter consume that contract; neither route hierarchy defines the other. Machine resources live under `/api/v1`. Human presentation remains under `/events/raffle`.

## Authority

Member participation requires a normal authenticated Guildie session. Raffle validates current Character control, current guild membership, claim ownership, and participation availability.

Privileged operations use explicit global capabilities:

- `raffle.modify` — establish Raffles and modify terms before participation has opened.
- `raffle.stage` — open, pause, or resume participation and cancel an unconcluded Raffle.
- `raffle.claims` — inspect and adjudicate claims.
- `raffle.draw` — perform the manual draw.

Rank 0 and the configured operator override remain inherently permitted by global capability machinery. Aggregate “can operate Raffle” checks are presentation checks, not mutation authority.

REST reads use the global read credential:

```http
Authorization: Bearer <API_READ_KEY>
```

That credential grants no human/member mutation authority.

## Raffle truth

A Raffle is the concrete activity. There is no parent Raffle/round distinction and no persisted `listed/live/concluded` status.

Relevant truth is represented independently:

- the Raffle is established when its durable record exists;
- participation Offer intake has never opened, is currently accepting new Offers, or is operator-paused;
- `conclusion` is `null` while operational, then `drawn`, `operator_cancelled`, or `no_participation`;
- operator pause is a reversible, attributed gate on new Offer intake and may be resumed before the cutoff;
- the current one-hour cutoff is an organizer-declared Raffle condition: after it is reached, new Offers are inadmissible even though time itself performs no Raffle transition;
- the cutoff protects the adjudication interval from actual or perceived preferential manipulation and is intended to become configurable Raffle procedure;
- drawing is likewise an actor-requested operation that cannot succeed before `drawing_at_unix`.

## Versioned REST API

The promoted Raffle REST surface is intentionally read-only. A machine credential does not manufacture a Guildie actor, participant ownership, or human judgment authority.

### GET `/api/v1/raffles/:raffleId`

Returns one authoritative Raffle projection. Unknown coordinates return `404 raffle_not_found`.

Representative shape:

```json
{
  "raffle_id": "...",
  "title": "September Raffle",
  "conclusion": null,
  "drawing_at_unix": 1788901200,
  "participation": {
    "open": true,
    "opened_at_unix": 1788810000,
    "paused_at_unix": null,
    "resumed_at_unix": null
  },
  "entry_price_gold": "1000",
  "prize": {
    "kind": "gold",
    "winner_percentage": 50,
    "description": null
  },
  "created_at_unix": 1788800000,
  "concluded_at_unix": null,
  "claims": {
    "pending": 1,
    "approved": 2,
    "denied": 1,
    "revoked": 0,
    "approved_entries": 5
  }
}
```

Only approved claims contribute to approved entries, the gold pot, and the drawing population.

### GET `/api/v1/raffle/claims/:claimId`

Returns one claim projection. It intentionally omits claimant Guildie IDs and resolution-actor Guildie IDs. Unknown coordinates return `404 claim_not_found`.

## Authenticated application adapter

These routes support Guild Operations interaction surfaces. They are not the promoted machine API.

### Raffle operations

- `POST /raffle` — `raffle.modify`; establish a Raffle.
- `PATCH /raffle/:raffleId` — `raffle.modify`; modify terms only before participation has ever opened. Opening participation permanently locks ticket price and all other Raffle terms; pausing does not unlock them.
- `POST /raffle/:raffleId/participation/open` — `raffle.stage`; open participation before the one-hour freeze.
- `POST /raffle/:raffleId/participation/pause` — `raffle.stage`; pause new claims while preserving the operational Raffle. Repeated pause is a no-op.
- `POST /raffle/:raffleId/participation/resume` — `raffle.stage`; resume a currently paused Raffle before the one-hour cutoff. Repeated resume is a no-op.
- `POST /raffle/:raffleId/cancel` — `raffle.stage`; conclude with `operator_cancelled` while preserving Raffle evidence.
- `POST /raffle/:raffleId/draw` — `raffle.draw`; draw only at or after the declared drawing time and only after every claim is resolved.
- `GET /raffle/:raffleId` — authenticated Guildie; read the domain Raffle.
- `GET /raffle/:raffleId/claims` — `raffle.claims`; inspect the operational claim ledger.

Establishment/modification body:

```json
{
  "title": "September Raffle",
  "drawing_at_unix": 1788901200,
  "entry_price_gold": 1000,
  "prize_kind": "gold",
  "winner_percentage": 50,
  "prize_description": null
}
```

### Claim operations

- `POST /raffle/:raffleId/claims` — member session plus Raffle participation rules; establish a claim.
- `POST /raffle/claims/:claimId/revoke` — claim owner; revoke their unresolved claim before the Raffle concludes.
- `POST /raffle/claims/:claimId/approve` — `raffle.claims`; approve an unresolved claim.
- `POST /raffle/claims/:claimId/deny` — `raffle.claims`; deny an unresolved claim with a required reason.

Claim establishment body:

```json
{
  "realm_id": "...",
  "character_id": "...",
  "entry_count": 5
}
```

Entries are derived equal-weight drawing positions. They are not independent persisted objects.

## Human presentation paths

Application REST/resource paths are not web navigation paths. Current human surfaces include:

- `/events/raffle`
- `/events/raffle/enter`
- `/events/raffle/claims`
- `/events/raffle/:raffleId`
- `/events/raffle/history`
- `/events/raffle/rules`
- `/events/raffle/manage`
- `/events/raffle/manage/:raffleId`

These paths express human participation and operation. They meet REST and other adapters at the Raffle application contract, not through shared URL conventions.

## Time

Persisted and HTTP operational instants use Unix seconds. Human-readable time and timezone are presentation concerns.
