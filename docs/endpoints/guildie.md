# Guildie and Character Query Endpoints

This document is the canonical HTTP reference for the machine-readable Guildie and Character projections used by publication subscribers.

## Authority class

The current query endpoints use the read-only machine credential `EVENT_QUERY_API_KEY`.

This credential grants no Guild Operations operation authority. It lets external subscribers that receive publication coordinates ask Guild Operations what is authoritative now without acquiring a human session.

## Guildie query

### GET `/events/query/guildies/:guildieId`

Returns the current Guildie projection for one durable `guildie_id`.

The response includes the current Discord association, selected-main projection, and current organizational membership. Current organizational membership is either present with effective rank or `null`.

```json
{
  "guildie_id": "0127694c-d28b-49eb-83ee-a190d313901f",
  "discord": null,
  "guild": {
    "membership": {
      "guild_id": "65431436",
      "rank": 2,
      "rank_name": "Rank 2"
    },
    "main_character": null
  }
}
```

A `null` membership does not mean the Guildie was deleted or closed. It means the Guildie currently controls no Character present on the Blizzard Character roster and therefore has no current guild participation surface or rank-derived authority.

Effective rank is the highest-authority rank among currently controlled roster Characters. Selected main remains presentation preference, not identity or authorization.

## Character query

### GET `/events/query/guilds/:guildId/character-members/:region/:realmId/:characterId`

Returns current authoritative roster truth for exactly one Blizzard Character coordinate. This is the follow-up query for `character.*` publications; it is intentionally not a whole-roster query.

When the Character is not currently on the roster, the coordinate remains a valid query and `membership` is `null`. That behavior lets a `character.left` publication identify the affected Character while the query establishes its current absence.

## Subscriber usage

```text
receive publication
    ↓
read concrete object coordinates
    ↓
query Guild Operations
    ↓
observe current authoritative state
    ↓
converge local projection
```

Publications and query endpoints name actual domain objects. They do not use a generic Subject coordinate.
