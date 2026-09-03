# Subject Publications

This document is the canonical publication catalog for Guild Operations subject machinery.

It answers what Subject machinery publishes after meaningful authoritative subject truth changes. It does not define HTTP response contracts or BotGhost-specific setup. Subject query contracts live in `docs/endpoints/subject.md`; the cross-cutting publication model lives in `docs/publication-model.md`; the current BotGhost transport cheat sheet lives in `docs/integrations/botghost.md`.

## Current subject publications

### `subject.discord.linked`

Published when a subject establishes a new Discord association.

Coordinates:

- `subjectId`
- `discordUserId`

Follow-up query:

```http
GET /events/query/subjects/:subjectId
```

The publication does not command a Discord-side action. A subscriber uses the coordinates to locate the affected projection and then queries Guild Operations for current truth.

### `subject.discord.unlinked`

Published when an existing Discord association is removed.

Coordinates:

- `subjectId`
- `discordUserId`

Follow-up query:

```http
GET /events/query/subjects/:subjectId
```

`discordUserId` is intentionally retained as a disappearing coordinate. Current subject state correctly contains no Discord association after unlink, but a subscriber may still need the removed Discord user ID to clean up its local projection.

### `subject.main.changed`

Published when the subject's selected main actually changes.

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
| `subject.discord.linked` | `subjectId`, `discordUserId` | `GET /events/query/subjects/:subjectId` |
| `subject.discord.unlinked` | `subjectId`, `discordUserId` | `GET /events/query/subjects/:subjectId` |
| `subject.main.changed` | `subjectId`, `guildId` | `GET /events/query/subjects/:subjectId` |

## Scope boundary

Subject publications concern Guild Operations-owned subject state, associations, and preferences.

They are not a report of every Blizzard-observed account or character change. Controlled characters outside the guild remain valid subject observations, but those observations do not automatically become member publications.

Member publications will concern meaningful changes in the derived subject-to-guild relationship. Guild publications will concern meaningful changes to guild-owned or authoritative guild-observed truth. Those publications should be added only when their concrete reconciliation machinery exists.
