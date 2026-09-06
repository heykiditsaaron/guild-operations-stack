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

This document owns that derivation. The member objects themselves are defined in [`member-objects.md`](member-objects.md), while the Blizzard evidence that established the underlying coordinates is recorded in [`blizzard-authority.md`](blizzard-authority.md).

## Independent authority surfaces

Blizzard account authority establishes which Characters a Guildie currently controls.

Blizzard guild-roster authority separately establishes which Characters are currently members of OH CRIT I Pulled! and the numeric guild rank attached to each current roster Character.

Neither observation substitutes for the other:

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

Character profile or media presentation is another independent Blizzard observation and cannot establish either control or guild membership.

## Current Guildie participation

A Guildie has a current participation surface when at least one Character they currently control is also currently present on the Blizzard guild roster.

```text
at least one controlled roster Character
    → current Guildie organizational participation

zero controlled roster Characters
    → Guildie remains durable and known
    → no current guild participation surface
    → no rank-derived authority
```

This is derived current state, not a second independently persisted source of membership truth.

A change to either side of the intersection may change the Guildie's current participation surface. Guild refresh changes the roster observation; Blizzard account/control reconciliation may change the control observation. Neither procedure owns the other's authority.

## Effective guild rank

Blizzard owns the numeric rank on each current Character roster membership. Guild Operations derives the Guildie's effective rank from the controlled Characters that survive the authority intersection.

When more than one controlled roster Character exists, the effective rank is the highest-authority Blizzard rank among them. Under the guild's current Blizzard ordering, lower numeric `rank_index` means higher authority.

The selected main does not participate in this calculation.

Guild Operations may attach first-party meaning or presentation to numeric rank values, but it does not rewrite the Blizzard rank fact itself. Rank definitions and application permission translation are documented in [`guild-permissioning.md`](guild-permissioning.md).

## Canonical join coordinates

The durable Character-side join coordinate is:

```text
region + realm_id + character_id
```

Current authority must be joined by Blizzard-native Character coordinates rather than by mutable presentation fields such as Character name or realm name.

The configured guild is identified internally by Blizzard's numeric `guild_id`. Descriptive guild fields and API lookup locators may change without changing that identity.

The empirical Blizzard observations that established these coordinate choices belong in [`blizzard-authority.md`](blizzard-authority.md), not in this derivation contract.

## Persistence and refresh boundaries

Guild Operations persists Blizzard account-control and roster observations so current authority can be derived consistently. Persistence ownership is documented in [`global-persistence.md`](global-persistence.md), while account/control transaction behavior is documented in [`persistence-boundary.md`](persistence-boundary.md).

Guild roster reconciliation is documented in [`guild-refresh.md`](guild-refresh.md). Self account refresh is documented in [`self-account-refresh.md`](self-account-refresh.md).

Those procedures may change one side of the authority intersection, but this derivation remains the same.

## Authority invariant

> A Guildie's current guild participation and rank-derived authority exist only where Blizzard-demonstrated Character control intersects Blizzard's current guild roster.

Guildie continuity survives changes to that intersection. Current authority does not.
