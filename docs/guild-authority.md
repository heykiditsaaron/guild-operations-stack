# Guild Authority

## Purpose

Guild Operations derives a Guildie's current organizational membership by joining two independent Blizzard-authoritative surfaces:

```text
Authenticated Account Profile
        ∩
Public Guild Character Roster
        ↓
current roster Characters controlled by the Guildie
        ↓
current Guildie participation surface + effective rank
```

This avoids asking a member to manually declare guild Character identity when Blizzard can establish both sides of that relationship.

The durable Subject coordinate resolves which Guildie is operating. Subject recognition is not itself guild membership.

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

The live roster response contained 517 Character members. Each roster member exposed:

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

The durable Character-side join coordinate is:

```text
region + realm_id + character_id
```

A live comparison against the already authenticated Subject established:

```text
authenticated Characters: 20
current Character-roster intersections: 9
```

All nine intersections matched by Blizzard Character and realm identifiers rather than by character name.

This is sufficient evidence for Guild Operations to resolve which current guild Characters are controlled by the Guildie represented through that Subject.

## Character roster and Guildie roster

The **Character roster** is Blizzard-owned current in-game guild membership. A Character is either currently present with a Blizzard numeric rank or it is not currently present.

The **Guildie roster** is Guild Operations-derived organizational membership:

```text
Guildie's currently controlled Characters
                ∩
current Blizzard Character roster
                ↓
current Guildie organizational membership
```

At least one controlled Character on the current Character roster gives the Guildie a current participation surface. Zero controlled roster Characters removes that current participation surface and rank-derived authority without deleting the Guildie, Subject, associations, preferences, or history.

## Rank authority

Blizzard publishes guild rank as an integer on each current Character roster membership. Live observation found ranks:

```text
0, 1, 2, 3, 4, 5, 7
```

Rank `6` currently has no roster occupants and is intentionally unused by the guild. This demonstrates that Guild Operations must not infer the available rank space from currently populated roster values.

Blizzard does not expose the guild's custom human-readable rank names in the Guild Profile or Guild Roster payloads observed during reconnaissance.

Therefore:

> Blizzard owns the numeric rank fact on each current Character. Guild Operations owns configurable meaning and presentation for that number outside WoW and derives each current Guildie's effective rank from their controlled roster Characters.

A Guildie's effective rank is the highest-authority rank among all currently controlled Characters on the Character roster. Under Blizzard's current ordering, lower numeric `rank_index` means higher authority.

Conceptually:

```text
Guild 65431436 / Rank 2
├── canonical: rank_index = 2
└── Guild Operations metadata
    ├── display_name
    ├── active/inactive presentation state
    ├── later: Discord role projection
    └── later: Guildie-facing permissions
```

Discord role mapping and Guild Operations authorization must remain separate consumers of rank metadata. A Discord role must never become the source of backend permission authority.

## Persistence boundary

The executable model separates three concerns.

### Guild

The canonical row is keyed by Blizzard `guild_id`. Current descriptive Blizzard fields are retained as observed metadata and refreshed without changing identity.

### Character roster membership

A Character roster membership is keyed by:

```text
guild_id + region + realm_id + character_id
```

It retains current Blizzard rank and presentation observations plus `first_seen_at`, `last_seen_at`, and `currently_present`.

Roster refresh is non-destructive. A Character omitted by a later Blizzard roster response is marked not currently present rather than deleted. Historical Guild Operations activity must not depend on continued roster presence.

### Guild rank definition

Guild Operations rank metadata is keyed by:

```text
guild_id + rank_index
```

The numeric rank remains the durable reference. Display names and other projections are mutable configuration.

The Guildie roster itself is derived from current Character control and current Character roster state rather than persisted as an independent authority source.

## Acquisition boundary

Guild profile and Character roster acquisition use a Blizzard client-credentials token rather than member OAuth. External Blizzard HTTP calls complete before the database transaction begins.

Guild Operations verifies both the Guild Profile and Guild Roster against configured canonical guild id `65431436` before persisting the observation.

## Current executable acceptance criterion

Given an authenticated Subject resolving a Guildie and a refreshed Blizzard Character roster, the backend can identify which Characters that Guildie currently controls on the OH CRIT I Pulled! roster, derive whether the Guildie has a current participation surface, and compute the Guildie's effective numeric guild rank from those current Character memberships.
