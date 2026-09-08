# Guildie Publications

This document records the Guildie publication contracts retained from the previous global publication design.

The global publication transport is not currently active. If Guildie publications are reintroduced, subscribers must resolve current Guildie truth through the promoted global REST surface rather than treating publication payloads as durable state.

A Guildie is identified by the durable `guildieId` coordinate. Guildie continuity is non-destructive: current organizational participation may appear or disappear as controlled Characters enter or leave the current Character roster without creating or destroying the Guildie.

`Subject` is not a publication coordinate or domain object. It is contextual language only.

## `guildie.discord.linked`

Coordinates:

- `guildieId`
- `discordUserId`

Authoritative follow-up:

```http
GET /api/v1/guildies/:guildieId
```

## `guildie.discord.unlinked`

Coordinates:

- `guildieId`
- `discordUserId`

Authoritative follow-up:

```http
GET /api/v1/guildies/:guildieId
```

`discordUserId` is intentionally retained as the disappearing external coordinate so a subscriber can clean up its projection after current Guildie truth no longer contains the association.

## `guildie.main.changed`

Coordinates:

- `guildieId`
- `guildId`

Authoritative follow-up:

```http
GET /api/v1/guildies/:guildieId
```

## Retained catalog

| Publication | Coordinates | Authoritative follow-up |
| --- | --- | --- |
| `guildie.discord.linked` | `guildieId`, `discordUserId` | `GET /api/v1/guildies/:guildieId` |
| `guildie.discord.unlinked` | `guildieId`, `discordUserId` | `GET /api/v1/guildies/:guildieId` |
| `guildie.main.changed` | `guildieId`, `guildId` | `GET /api/v1/guildies/:guildieId` |
