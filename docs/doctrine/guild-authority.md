# Guild Authority

## Purpose

Guild Operations derives a Guildie's current organizational participation and effective guild rank by joining two independent Blizzard-authoritative observations:

```text
Guildie account/control observation
        ∩
current Blizzard guild Character roster
        ↓
controlled roster Characters
        ↓
current Guildie participation surface
        +
effective numeric guild rank
```

This document owns that derivation. Member meanings live in [`member-objects.md`](member-objects.md); empirical Blizzard evidence lives in [`../reference/blizzard-authority.md`](../reference/blizzard-authority.md).

## Independent authority surfaces

Blizzard account authority establishes which Characters a Guildie currently controls.

Blizzard guild-roster authority separately establishes which Characters are currently members of OH CRIT I Pulled! and the numeric guild rank attached to each current roster Character.

Neither substitutes for the other:

```text
control without roster membership
    → known controlled Character
    → not currently eligible for Guild Operations guild participation

roster membership without demonstrated Guildie control
    → current guild Character
    → not attributable to that Guildie

control + roster membership
    → eligible Guild Operations Character for that Guildie
```

Character presentation is another independent observation and cannot establish either control or guild membership.

## Current Guildie participation

At least one controlled roster Character gives the Guildie a current organizational participation surface. Zero controlled roster Characters leaves the durable Guildie known but removes current guild participation and rank-derived authority.

This is derived current state, not a second independently persisted source of membership truth.

Procedures may change either side of the intersection. The derivation itself remains authoritative regardless of which current infrastructure performed the refresh.

## Effective guild rank

Blizzard owns the numeric rank on each current roster Character. Guild Operations derives the Guildie's effective rank from controlled Characters that survive the authority intersection.

When more than one exists, effective rank is the highest-authority Blizzard rank among them. Under the guild's current Blizzard ordering, lower numeric `rank_index` means higher authority.

Selected main does not participate in this calculation.

Guild Operations may attach first-party meaning or presentation to numeric rank values without rewriting the Blizzard rank fact itself. Current capability machinery is documented in [`../infrastructure/guild-permissioning.md`](../infrastructure/guild-permissioning.md).

## Durable join coordinates

Character authority joins by:

```text
region + realm_id + character_id
```

Mutable presentation fields such as Character name or realm name are not continuity coordinates.

The configured guild is identified internally by Blizzard's numeric `guild_id`.

## Authority invariant

> A Guildie's current guild participation and rank-derived authority exist only where Blizzard-demonstrated Character control intersects Blizzard's current guild roster.

Guildie continuity survives changes to that intersection. Current authority does not.
