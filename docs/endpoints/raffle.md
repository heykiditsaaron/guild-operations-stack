# Raffle Endpoints

This document is the canonical HTTP endpoint reference for the Guild Operations raffle feature.

It describes raffle query and operation surfaces only. It does not define Discord behavior, BotGhost commands, raffle UI presentation, or generic application API conventions. Raffle system-event publications are cataloged separately in `docs/publications/raffle.md`; cross-cutting publication behavior lives in `docs/publication-model.md`.

## Authority classes

Raffle endpoints use three distinct authority classes.

### Member session

A signed-in Guildie authenticated by the normal application session cookie.

Member session authority is used for member-owned raffle participation and for browser-facing authenticated reads.

### `raffle.admin`

A signed-in Guildie whose current guild authority satisfies the Raffle module's `raffle.admin` policy.

Raffle owns this policy. It currently derives administration authority from the Guildie's effective Blizzard guild rank: rank indexes `0`, `1`, and `2` may administer raffles. `raffle.admin` is not persisted as a global guild capability assignment.

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

This credential grants no raffle operation authority. It exists so external systems that receive authoritative raffle publication coordinates can ask Guild Operations for the current authoritative raffle projection without acquiring a human session or `raffle.admin` authority.

If the credential is not configured, machine query routes return `503 raffle_query_not_configured`. Missing or incorrect credentials return `401 raffle_query_authority_required`.

## Raffle lifecycle projection

A raffle round exposes lifecycle and conclusion separately.

`status` is one of:

- `listed`
- `live`
- `concluded`

`conclusion` is `null` until the round concludes. A concluded round has one of:

- `drawn`
- `operator_cancelled`
- `no_participation`

Creation is an operation that establishes a `listed` round; `created` is not a lifecycle state.

## Machine query endpoints

These endpoints are the preferred read surface for non-browser systems following raffle publication coordinates.

### GET `/raffle/query/live`

Returns the currently live raffle, or `null` when there is no live raffle.

Authority: raffle machine query authority.

Response:

```json
{
  "round": {
    "roundId": "...",
    "status": "live",
    "conclusion": null,
    "drawingAtUnix": 0,
    "ticketPriceGold": "1000",
    "prizeKind": "gold",
    "winnerPercentage": 50,
    "prizeDescription": null,
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

For item and other prizes, `winnerPercentage` is `null`, `prizeDescription` contains the configured descriptive prize, and `gold` is `null`.

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
{ "round": { "...": "same round projection as /raffle/query/live, including status and conclusion" } }
```

Not found:

```json
{ "error": "round_not_found" }
```

A round concluded by drawing has `status: "concluded"` and `conclusion: "drawn"`, and may additionally contain:

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
    "roundConclusion": null,
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

The machine claim projection intentionally omits canonical Guildie IDs and attendant Guildie IDs. External consumers receive the raffle fact and useful WoW recognition coordinates, not unrelated member authority.

## Authenticated raffle reads

These routes primarily support Guild Operations browser/application interactions. They are not the preferred machine query surface.

### GET `/raffle/rounds/:roundId`

Returns the domain round object for an authenticated Guildie, including separate `status` and `conclusion` values.

Authority: member session.

Not found:

```json
{ "error": "round_not_found" }
```

### GET `/raffle/rounds/:roundId/claims`

Returns every claim for the specified round.

Authority: member session plus Raffle module `raffle.admin` authority.

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

Creates a raffle round and establishes it immediately as `listed`. A listed round is an upcoming participatory occurrence: it may be discovered and its terms may still be edited, but claims are not accepted until it becomes live.

Authority: `raffle.admin`.

Gold-prize body:

```json
{
  "round_title": "September Raffle",
  "drawing_at_unix": 0,
  "ticket_price_gold": 1000,
  "prize_kind": "gold",
  "winner_percentage": 50,
  "prize_description": null
}
```

`round_title` is optional; omitted, `null`, or blank input is normalized to no title. For item or other prizes, `winner_percentage` must be `null` and `prize_description` must be non-empty descriptive text:

```json
{
  "round_title": null,
  "drawing_at_unix": 0,
  "ticket_price_gold": 1000,
  "prize_kind": "item",
  "winner_percentage": null,
  "prize_description": "Reins of the Swift Spectral Tiger"
}
```

Success: `201` with the listed round.

The Raffle module establishes the corresponding Guild Event Listing in the same database transaction as the round. If listing establishment fails, round creation fails rather than leaving the Registry out of sync.

### PATCH `/raffle/rounds/:roundId`

Updates terms of a listed round. Terms are locked once the round becomes live.

Authority: `raffle.admin`.

Body: same terms shape as round creation.

The updated raffle truth and its updated Guild Event Listing commit together.

### POST `/raffle/rounds/:roundId/live`

Transitions a listed raffle to `live`.

Authority: `raffle.admin`.

The guild may have at most one live raffle. A conflicting activation returns `409 active_round_exists`.

The live transition and the corresponding Guild Event Listing update commit together. Publication, where configured, occurs only after that authoritative transaction succeeds.

### POST `/raffle/rounds/:roundId/cancel`

Administratively concludes a listed or live round with:

```json
{
  "status": "concluded",
  "conclusion": "operator_cancelled"
}
```

Authority: `raffle.admin`.

Operator cancellation is a short-circuited conclusion. It revokes participation eligibility before intended resolution. Raffle therefore withdraws its Guild Event Listing in the same transaction that records the conclusion.

Cancellation does not rewrite claims or other pre-conclusion raffle state. Unresolved claims may remain unresolved because the preserved round is an audit record, not a cleaned-up reconstruction.

### POST `/raffle/rounds/:roundId/draw`

Manually resolves a live raffle.

Authority: `raffle.admin`.

Drawing refuses to proceed while unresolved claims exist.

The authoritative drawing population is derived deterministically from approved claims. Claims themselves are not rewritten by drawing.

If the derived ticket population is non-empty, the result is:

```json
{
  "status": "concluded",
  "conclusion": "drawn"
}
```

The round records the total population, selected index, and winning claim as draw evidence.

If the derived ticket population is empty, the result is:

```json
{
  "status": "concluded",
  "conclusion": "no_participation"
}
```

`no_participation` is not cancellation. No draw-result fields are invented for the empty population; the zero population remains reconstructable from preserved claim truth.

Both normal conclusions retain and update the raffle's Guild Event Listing to the best-known occurrence range. The raffle conclusion and listing update commit together.

## Claim operations

### POST `/raffle/rounds/:roundId/claims`

Submits a Guildie-authored raffle claim for a currently controlled Character on the current guild roster.

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

The claim preserves two different relationships: the claimant Guildie and the participating Character. Those roles are not collapsed into a generic Subject coordinate.

A claim is promissory. Approval establishes immutable ticket weight; the individual ticket units are derived from approved claim truth rather than persisted independently.

A rejected submission does not create a claim, so no raffle system event is established and nothing is published.

### POST `/raffle/claims/:claimId/cancel`

Cancels the caller's own unresolved claim while its round is live.

Authority: member session; Guildie claim ownership is enforced by the domain.

Success: `204`.

An approved claim cannot be cancelled or withdrawn. Once approval establishes ticket weight, that weight remains part of the round's drawing basis.

### POST `/raffle/claims/:claimId/approve`

Records an attendant judgment that the claim's promised guild-bank deposit was fulfilled.

Authority: `raffle.admin`.

Success: `204`.

Approval is immutable.

### POST `/raffle/claims/:claimId/deny`

Records an attendant judgment denying an unresolved claim.

Authority: `raffle.admin`.

Body:

```json
{ "reason": "Required reason" }
```

Success: `204`.

## Publication relationship

Successful operations may publish only after authoritative raffle state has changed. Publication is not authoritative raffle state and publication failure does not reverse a successful raffle operation.

The ownership and transport architecture for raffle publications remains under evaluation. The existing publication surface is therefore provisional and must not be treated as a reason to duplicate raffle truth outside the module.

The current catalog of published raffle system events and their coordinates lives in `docs/publications/raffle.md`.

## Time values

All HTTP and persisted raffle time values that represent operational instants use Unix seconds. Consumers decide how to express those instants to humans in the viewer's local timezone.

`datetime-local` is a browser input concern only and is converted to a timezone-neutral instant before a raffle operation crosses the backend boundary.

Server or container timezone is not raffle persistence or presentation policy.

`Subject` is not an endpoint authority class or response identity. It remains contextual language only.
