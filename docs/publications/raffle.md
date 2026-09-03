# Raffle Publications

This document is the canonical publication catalog for Guild Operations raffle events.

It answers what raffle machinery publishes after meaningful authoritative raffle truth changes. HTTP contracts live in `docs/endpoints/raffle.md`; the current BotGhost transport cheat sheet lives in `docs/integrations/botghost.md`.

## Publication model

Raffle publications are emitted only after the authoritative raffle operation succeeds. They carry semantic occurrence plus small coordinates rather than flattened raffle state.

Subscribers use those coordinates to query Guild Operations for current authoritative raffle reality. Publication failure does not undo a successful raffle operation.

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

The publication says that meaningful raffle reality changed. The follow-up query answers what that raffle reality is now.
