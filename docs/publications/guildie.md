# Guildie Publications

This document is the canonical publication catalog for Guild Operations state belonging to the human guild member.

A Guildie is resolved through a durable Subject coordinate. The publication kind names the Guildie state that changed; `subjectId` remains the durable recognition coordinate used to identify which Guildie the occurrence concerns.

Guildie continuity is non-destructive. Current organizational membership may appear or disappear as controlled Characters enter or leave the current Character roster, without creating or destroying the Guildie.

See `docs/publication-model.md` for the cross-cutting publication model and `docs/publications/guild-reconciliation.md` for Character/Guildie roster transitions.

## Guildie-owned state

### `guildie.discord.linked`

Published when a Guildie establishes a new Discord association.

Coordinates:

- `subjectId`
- `discordUserId`

Follow-up query:

```http
GET /events/query/subjects/:subjectId
```

The publication does not command a Discord-side action. A subscriber uses the coordinates to locate the affected projection and then queries Guild Operations for current truth.

### `guildie.discord.unlinked`

Published when an existing Discord association is removed.

Coordinates:

- `subjectId`
- `discordUserId`

Follow-up query:

```http
GET /events/query/subjects/:subjectId
```

`discordUserId` is intentionally retained as a disappearing coordinate. Current Guildie state correctly contains no Discord association after unlink, but a subscriber may still need the removed Discord user ID to clean up its local projection.

### `guildie.main.changed`

Published when the Guildie's selected main actually changes.

Coordinates:

- `subjectId`
- `guildId`

Follow-up query:

```http
GET /events/query/subjects/:subjectId
```

Selecting the already-selected main is a no-op and does not publish.

## Current publication catalog

| Publication | Coordinates | Authoritative follow-up |
| --- | --- | --- |
| `guildie.discord.linked` | `subjectId`, `discordUserId` | `GET /events/query/subjects/:subjectId` |
| `guildie.discord.unlinked` | `subjectId`, `discordUserId` | `GET /events/query/subjects/:subjectId` |
| `guildie.main.changed` | `subjectId`, `guildId` | `GET /events/query/subjects/:subjectId` |

## Boundary with Subject

Subject is the durable recognition coordinate and continuity mechanism. Guildie is the guild-facing human member object resolved through that coordinate.

Discord association and selected-main preference belong semantically to the Guildie even though their persistence and lookup remain keyed by `subject_id`.
