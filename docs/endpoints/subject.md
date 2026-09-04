# Guildie and Character Query Endpoints

This document is the canonical HTTP reference for the current machine-readable Guildie and Character projections used by publication subscribers.

The existing route paths remain keyed through Subject and character-membership terminology for compatibility. Their semantic meaning is now expressed using the established Subject / Character / Guildie model. Route and transport naming can be migrated separately without changing the authoritative model.

## Authority class

The current query endpoints use a read-only machine credential configured as:

```text
EVENT_QUERY_API_KEY=<secret>
```

Machine requests may send either `Authorization: Bearer <EVENT_QUERY_API_KEY>` or the raw configured value in the `Authorization` header.

This credential grants no Guild Operations operation authority. It exists so external subscribers that receive publication coordinates can ask Guild Operations what is authoritative now without acquiring a human session.

## Guildie query

### GET `/events/query/subjects/:subjectId`

Returns the current Guildie projection resolved through the durable `subjectId` recognition coordinate.

The response includes the current Discord association, selected-main projection, and current organizational membership. Current organizational membership is either present with effective rank or `null`.

```json
{
  "subject_id": "0127694c-d28b-49eb-83ee-a190d313901f",
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

`subject_id` identifies the Guildie; it does not make the returned Guildie state Subject-owned.

A `null` membership does not mean the Guildie was deleted or closed. It means the Guildie currently controls no Character present on the Blizzard Character roster and therefore has no current guild participation surface or rank-derived authority.

Effective rank is the highest-authority rank among currently controlled roster Characters.

`discord` is either the Guildie's current Guild Operations Discord association or `null`. `guild.main_character` is the current selected-main projection or `null`. Selected main remains presentation preference, not identity or authorization.

## Character query

### GET `/events/query/guilds/:guildId/character-members/:region/:realmId/:characterId`

Returns current authoritative roster truth for exactly one Blizzard Character coordinate. This is the follow-up query for `character.*` publications; it is intentionally not a whole-roster query.

```json
{
  "guild_id": "65431436",
  "region": "us",
  "realm_id": "1136",
  "character_id": "159969501",
  "membership": {
    "currently_present": true,
    "rank": 2,
    "character_name": "Chiwee",
    "realm_name": "Aegwynn",
    "realm_slug": "aegwynn"
  }
}
```

When the Character is not currently on the roster, the coordinate remains a valid query and current membership is absent:

```json
{
  "guild_id": "65431436",
  "region": "us",
  "realm_id": "1136",
  "character_id": "159969501",
  "membership": null
}
```

That behavior is important for `character.left`: the publication identifies the affected Character while the query establishes current absence.

## Subscriber usage

```text
receive publication
    ↓
read coordinates
    ↓
query Guild Operations
    ↓
observe current authoritative state
    ↓
converge local projection
```

Delayed or out-of-order publications therefore do not require replaying stale state.
