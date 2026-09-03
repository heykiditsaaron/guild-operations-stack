# Raffle Publications

This document is the canonical publication catalog for Guild Operations raffle system events.

It answers which system events raffle machinery publishes after meaningful authoritative raffle truth changes, which coordinates those publications carry, and where a subscriber can query current authoritative raffle state afterward.

The raffle module itself is described in `docs/raffle.md`. HTTP contracts live in `docs/endpoints/raffle.md`; cross-cutting publication doctrine lives in `docs/publication-model.md`; the current BotGhost transport cheat sheet lives in `docs/integrations/botghost.md`.

The term **system event** here describes an operational occurrence published by Raffle. It is distinct from **Events**, the Guild Operations product category for participatory guild activities.

## Publication model

Raffle system events are published only after the authoritative raffle operation succeeds and meaningful raffle truth actually changes. They carry semantic occurrence plus small authority-oriented coordinates rather than flattened raffle state.

Subscribers use those coordinates to query Guild Operations for current authoritative raffle reality. The publication creates attention; the query establishes what is true now.

A failed attempt to mutate raffle state publishes nothing. Publication delivery failure does not undo a successful raffle operation.

## Round publications

### `raffle.round.live`

Published after a prepared round successfully becomes live.

Coordinates:

- `roundId`

Follow-up query:

```http
GET /raffle/query/rounds/:roundId
```

A subscriber interested only in the currently live round may instead use:

```http
GET /raffle/query/live
```

### `raffle.round.drawn`

Published after a live round successfully concludes with approved entries and a winner.

Coordinates:

- `roundId`
- `winningClaimId`

Follow-up queries:

```http
GET /raffle/query/rounds/:roundId
GET /raffle/query/claims/:winningClaimId
```

The claim query is optional when the round projection provides everything the subscriber needs.

### `raffle.round.cancelled`

Published after a created or live round is administratively cancelled.

Coordinates:

- `roundId`

Follow-up query:

```http
GET /raffle/query/rounds/:roundId
```

### `raffle.round.no-entry-cancelled`

Published when a live round is drawn with no approved entries and concludes as `no_entry_cancelled`.

Coordinates:

- `roundId`

Follow-up query:

```http
GET /raffle/query/rounds/:roundId
```

## Claim publications

### `raffle.claim.submitted`

Published after a member-authored raffle claim is successfully established.

Coordinates:

- `roundId`
- `claimId`

Follow-up query:

```http
GET /raffle/query/claims/:claimId
```

A rejected submission establishes no claim and therefore publishes nothing.

### `raffle.claim.approved`

Published after an unresolved claim is successfully approved.

Coordinates:

- `roundId`
- `claimId`

Follow-up query:

```http
GET /raffle/query/claims/:claimId
```

### `raffle.claim.denied`

Published after an unresolved claim is successfully denied.

Coordinates:

- `roundId`
- `claimId`

Follow-up query:

```http
GET /raffle/query/claims/:claimId
```

A denial is a system event because the claim's authoritative resolution changed successfully. It is not a failed claim-submission attempt.

### `raffle.claim.cancelled`

Published after a member successfully cancels their own unresolved claim.

Coordinates:

- `roundId`
- `claimId`

Follow-up query:

```http
GET /raffle/query/claims/:claimId
```

## Current publication catalog

| Publication | Coordinates | Authoritative follow-up |
| --- | --- | --- |
| `raffle.round.live` | `roundId` | `GET /raffle/query/rounds/:roundId` or `GET /raffle/query/live` |
| `raffle.claim.submitted` | `roundId`, `claimId` | `GET /raffle/query/claims/:claimId` |
| `raffle.claim.approved` | `roundId`, `claimId` | `GET /raffle/query/claims/:claimId` |
| `raffle.claim.denied` | `roundId`, `claimId` | `GET /raffle/query/claims/:claimId` |
| `raffle.claim.cancelled` | `roundId`, `claimId` | `GET /raffle/query/claims/:claimId` |
| `raffle.round.drawn` | `roundId`, `winningClaimId` | `GET /raffle/query/rounds/:roundId`, optionally claim query |
| `raffle.round.cancelled` | `roundId` | `GET /raffle/query/rounds/:roundId` |
| `raffle.round.no-entry-cancelled` | `roundId` | `GET /raffle/query/rounds/:roundId` |

## Non-publications

The raffle publication catalog does not include failures of machinery or rejected attempts that establish no new raffle truth. Examples include:

- rejected claim submission before a claim exists;
- invalid request payload;
- authorization failure;
- database or network failure;
- constraint violation;
- BotGhost/webhook delivery failure;
- unexpected exception or failed mutation attempt.

Those belong to diagnostics or error logging rather than the raffle system-event publication stream.
