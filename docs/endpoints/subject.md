# Subject Endpoints

This document is the canonical HTTP endpoint reference for Guild Operations subject machinery exposed to machine consumers.

It describes the machine-readable query contract used by subscribers after receiving subject and subject-membership publication coordinates. The cross-cutting publication model is defined in `docs/publication-model.md`. Publication catalogs live under `docs/publications/`.

## Authority class

### Machine query authority

The current query endpoints use a read-only machine credential configured as:

```text
EVENT_QUERY_API_KEY=<secret>
```

Machine requests may send either:

```http
Authorization: Bearer <EVENT_QUERY_API_KEY>
```

or the raw configured value in the `Authorization` header.

The configuration name reflects the current implementation and may be refined separately; it does not make Events a domain owner of these surfaces.

This credential grants no Guild Operations operation authority. It exists so external subscribers that receive publication coordinates can ask Guild Operations what is authoritative now without acquiring a human session.

Missing or incorrect credentials return `401 Unauthorized` with `{ "error": "invalid_machine_authority" }`.

## Subject query

### GET `/events/query/subjects/:subjectId`

Returns the current authoritative subject projection needed by publication subscribers.

Authority: machine query authority.

Path coordinate:

- `subjectId` — canonical Guild Operations subject identifier.

The `guild.membership` projection is either the subject's current derived subject-membership or `null`. When present it contains the configured guild identifier and the subject's effective current rank: the highest-authority rank among currently controlled character-members.

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

The response is current state, not a reconstruction of the publication that caused the subscriber to query. Subject-membership is derived from currently controlled characters intersected with the current Blizzard guild roster. Capabilities are deliberately not exposed here; this projection answers current membership truth rather than granting or duplicating authorization.

`discord` is either the subject's current Guild Operations Discord association or `null`. An unlink publication may carry the removed Discord coordinate even though the current query returns `null`.

`guild.main_character` remains the subject's current selected-main projection or `null`. Selection is a presentation preference, never identity or authorization.

Unknown subject coordinates return `404` with `{ "error": "subject_not_found" }`. Invalid subject coordinates return `400` with `{ "error": "invalid_subject_coordinate" }`.

## Character-membership query

### GET `/events/query/guilds/:guildId/character-members/:region/:realmId/:characterId`

Returns current authoritative character-membership truth for exactly one Blizzard character coordinate. This is the follow-up query for `character-member.*` publications; it is intentionally not a whole-roster query.

Authority: machine query authority.

Path coordinates:

- `guildId` — Guild Operations' configured Blizzard guild identifier.
- `region` — Blizzard region (`us`, `eu`, `kr`, or `tw`).
- `realmId` — Blizzard realm identifier.
- `characterId` — Blizzard character identifier.

Current character-member:

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

When that coordinate is not currently a character-member, the coordinate still resolves as a valid query and current membership is explicitly absent:

```json
{
  "guild_id": "65431436",
  "region": "us",
  "realm_id": "1136",
  "character_id": "159969501",
  "membership": null
}
```

That behavior is important for `character-member.left`: the publication supplies the affected coordinate, while the query establishes that the character is no longer currently present. Historical roster observations are not returned as current membership.

An unsupported guild identifier returns `404` with `{ "error": "guild_not_found" }`. Malformed coordinates return `400` with `{ "error": "invalid_character_membership_coordinate" }`.

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

Delayed or out-of-order publications therefore do not require a subscriber to replay stale state. The follow-up query establishes the current answer.
