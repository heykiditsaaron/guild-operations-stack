# Event Endpoints

This document is the canonical HTTP endpoint reference for Guild Operations operational event query surfaces.

It describes the machine-readable query contract used by subscribers after receiving published event coordinates. Event semantics and publication rules are defined in `docs/events.md`. The publication catalog lives in `docs/publications/events.md`.

## Authority class

### Event machine query authority

Event query endpoints use a read-only machine credential configured as:

```text
EVENT_QUERY_API_KEY=<secret>
```

Machine requests may send either:

```http
Authorization: Bearer <EVENT_QUERY_API_KEY>
```

or the raw configured value in the `Authorization` header.

This credential grants no Guild Operations operation authority. It exists so external subscribers that receive event coordinates can ask Guild Operations what is authoritative now without acquiring a human session.

Missing or incorrect credentials return:

```http
401 Unauthorized
```

```json
{ "error": "invalid_machine_authority" }
```

## Subject query

### GET `/events/query/subjects/:subjectId`

Returns the current authoritative subject projection needed by the initial operational-event subscribers.

Authority: event machine query authority.

Path coordinate:

- `subjectId` — canonical Guild Operations subject identifier supplied by a published subject event or another trusted Guild Operations coordinate.

Success:

```http
200 OK
```

```json
{
  "subject_id": "0127694c-d28b-49eb-83ee-a190d313901f",
  "discord": {
    "discord_user_id": "187021259631099904",
    "username": "hotdamnitsaaron",
    "connected_at": "2026-09-03T09:32:34.677Z"
  },
  "guild": {
    "main_character": {
      "guild_id": "65431436",
      "character_id": "159969501",
      "realm_id": "1136",
      "name": "Chiwee",
      "realm_name": "Aegwynn",
      "rank": 2,
      "currently_eligible": true,
      "avatar_url": "https://render.worldofwarcraft.com/us/character/aegwynn/221/159969501-avatar.jpg"
    }
  }
}
```

The response is current state, not a reconstruction of the event that caused the subscriber to query.

### Discord projection

`discord` is either the subject's current Guild Operations Discord association or `null` when no current association exists.

```json
{ "discord": null }
```

An unlink event may still carry the removed `discordUserId` as an occurrence coordinate even though this query correctly returns `discord: null`. That disappearing coordinate lets a subscriber locate and remove a stale Discord-side projection while the query establishes what is true now.

### Selected-main projection

`guild.main_character` is either the subject's current selected-main projection or `null` when no main is selected.

```json
{
  "guild": {
    "main_character": null
  }
}
```

The selected-main projection includes guild and WoW recognition coordinates plus current eligibility. Selection is a Guild Operations presentation preference; the response does not make selected main an identity or authorization primitive.

## Errors

Unknown subject coordinate:

```http
404 Not Found
```

```json
{ "error": "subject_not_found" }
```

An invalid or empty subject coordinate is rejected as:

```http
400 Bad Request
```

```json
{ "error": "invalid_subject_coordinate" }
```

Unauthorized requests are rejected before subject lookup.

## Subscriber usage

A subscriber should treat published events as attention signals rather than durable state snapshots:

```text
receive event
    ↓
read coordinates
    ↓
query Guild Operations
    ↓
observe current authoritative state
    ↓
converge local projection
```

A delayed or out-of-order event therefore does not require the subscriber to replay stale state. The follow-up query establishes the current answer.
