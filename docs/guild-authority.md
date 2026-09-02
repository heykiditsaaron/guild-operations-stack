# Guild Authority

## Purpose

Guild Operations resolves a member's relationship with **OH CRIT I Pulled!** by joining two independent Blizzard-authoritative surfaces:

```text
Authenticated Account Profile
        ∩
Public Guild Roster
        ↓
current guild characters controlled by the subject
```

This avoids asking a member to manually declare guild character identity when Blizzard can establish both sides of that relationship.

## Live guild coordinate

Live Blizzard reconnaissance established the guild as:

```text
guild_id: 65431436
region: us
realm_id: 129
realm_slug: gurubashi
name: OH CRIT I Pulled
```

The numeric Blizzard `guild_id` is the canonical guild reference inside Guild Operations. Name, realm labels, faction, and other descriptive fields are observations or presentation data and may change without changing the guild's identity.

The current name and realm slug remain necessary as Blizzard API lookup coordinates. Guild Operations therefore configures those locators separately and verifies that the returned Blizzard object resolves to canonical guild id `65431436` before admitting a roster observation.

## Live roster result

The live roster response contained 517 members. Each roster member exposed:

```text
character.id
character.realm.id
character.name
character.realm
character.level
character.playable_class
character.playable_race
character.faction
rank
```

The durable member-side join coordinate is:

```text
region + realm_id + character_id
```

A live comparison against the already authenticated subject established:

```text
authenticated characters: 20
current guild-character intersections: 9
```

All nine intersections matched by Blizzard character and realm identifiers rather than by character name.

This is sufficient evidence for Guild Operations to resolve the authenticated subject's current OH CRIT I Pulled! guild representations mechanically.

## Rank authority

Blizzard publishes guild rank as an integer on each roster membership. Live observation found ranks:

```text
0, 1, 2, 3, 4, 5, 7
```

Rank `6` currently has no roster occupants and is intentionally unused by the guild. This demonstrates that Guild Operations must not infer the available rank space from currently populated roster values.

Blizzard does not expose the guild's custom human-readable rank names in the Guild Profile or Guild Roster payloads observed during reconnaissance.

Therefore:

> Blizzard owns the numeric rank fact. Guild Operations owns configurable meaning and presentation for that number outside WoW.

Conceptually:

```text
Guild 65431436 / Rank 2
├── canonical: rank_index = 2
└── Guild Operations metadata
    ├── display_name
    ├── active/inactive presentation state
    ├── later: Discord role projection
    └── later: member-facing permissions
```

Discord role mapping and Guild Operations authorization must remain separate consumers of rank metadata. A Discord role must never become the source of backend permission authority.

## Persistence boundary

The executable model separates three concerns.

### Guild

The canonical row is keyed by Blizzard `guild_id`. Current descriptive Blizzard fields are retained as observed metadata and refreshed without changing identity.

### Guild roster membership

A roster membership is keyed by:

```text
guild_id + region + realm_id + character_id
```

It retains current Blizzard rank and presentation observations plus `first_seen_at`, `last_seen_at`, and `currently_present`.

Roster refresh is non-destructive. A character omitted by a later Blizzard roster response is marked not currently present rather than deleted. Historical Guild Operations activity must not depend on continued roster presence.

### Guild rank definition

Guild Operations rank metadata is keyed by:

```text
guild_id + rank_index
```

The numeric rank remains the durable reference. Display names and other projections are mutable configuration.

## Acquisition boundary

Guild profile and roster acquisition use a Blizzard client-credentials token rather than member OAuth. External Blizzard HTTP calls complete before the database transaction begins.

Guild Operations verifies both the Guild Profile and Guild Roster against configured canonical guild id `65431436` before persisting the observation.

## Current executable acceptance criterion

Given an authenticated Guild Operations subject and a refreshed Blizzard guild roster, the backend can identify which of that subject's Blizzard-authoritative characters are currently on the OH CRIT I Pulled! roster and report the canonical numeric guild rank for each one.
