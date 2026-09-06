# Guildie Publications

This document is the canonical publication catalog for Guild Operations state belonging to the real-world guild organizational member.

A Guildie is identified by the durable `guildieId` coordinate. Guildie continuity is non-destructive: current organizational participation may appear or disappear as controlled Characters enter or leave the current Character roster without creating or destroying the Guildie.

`Subject` is not a publication coordinate or domain object. It is contextual language only.

See `docs/publication-model.md` for the cross-cutting publication model and `docs/publications/guild-reconciliation.md` for Character/Guildie roster transitions.

## `guildie.discord.linked`

Published when a Guildie establishes a new Discord association.

Coordinates:

- `guildieId`
- `discordUserId`

Follow-up query:

```http
GET /query/guildies/:guildieId
```

## `guildie.discord.unlinked`

Published when an existing Discord association is removed.

Coordinates:

- `guildieId`
- `discordUserId`

Follow-up query:

```http
GET /query/guildies/:guildieId
```

`discordUserId` is intentionally retained as the disappearing external coordinate so a subscriber can clean up its projection after current Guildie truth no longer contains the association.

## `guildie.main.changed`

Published when the Guildie's selected main actually changes.

Coordinates:

- `guildieId`
- `guildId`

Follow-up query:

```http
GET /query/guildies/:guildieId
```

Selecting the already-selected main is a no-op and does not publish.

## Current publication catalog

| Publication | Coordinates | Authoritative follow-up |
| --- | --- | --- |
| `guildie.discord.linked` | `guildieId`, `discordUserId` | `GET /query/guildies/:guildieId` |
| `guildie.discord.unlinked` | `guildieId`, `discordUserId` | `GET /query/guildies/:guildieId` |
| `guildie.main.changed` | `guildieId`, `guildId` | `GET /query/guildies/:guildieId` |
