# Guild Reconciliation Publications

Guild reconciliation compares Blizzard's newly acquired guild roster with the authoritative roster state Guild Operations already holds, persists the new observation, and publishes only meaningful changes established by that reconciliation.

See `docs/publication-model.md` for the cross-cutting publication rules.

## Roster model

The system has two related rosters with different authorities:

```text
Character roster
= Blizzard-observed current in-game guild membership

Guildie roster
= Guild Operations-derived current organizational membership
```

The Character roster is dictated by the actual WoW guild environment. A Character is either currently on that roster with a Blizzard-owned numeric rank, or it is not.

The Guildie roster is derived from controlled Characters intersecting the current Character roster. A Guildie is currently an organizational member when at least one Character they currently control is present on the Character roster.

Guildie continuity is durable. Losing the last controlled roster Character removes the Guildie's current participation surface and rank-derived authority; it does not delete, close, or invalidate the Guildie, Subject, Discord association, selected-main record, or historical participation.

## Character publications

### `character.joined`

Published when reconciliation establishes that a Character is currently on the Blizzard guild roster and was not currently present in the previous authoritative roster state.

Coordinates:

- `guildId`
- `region`
- `realmId`
- `characterId`

### `character.left`

Published when a Character that was previously currently present is absent from the newly acquired Blizzard guild roster.

Coordinates:

- `guildId`
- `region`
- `realmId`
- `characterId`

The Character remains a durable WoW object where Guild Operations already knows it. Historical participation is not rewritten.

### `character.rank.changed`

Published when Blizzard reports a different numeric guild rank for a currently present Character.

Coordinates:

- `guildId`
- `region`
- `realmId`
- `characterId`

Blizzard owns the numeric rank fact. Guild Operations owns what that rank means outside WoW.

## Guildie publications

### `guildie.joined`

Published when a known Guildie moves from controlling zero current roster Characters to controlling at least one.

Coordinates:

- `subjectId`
- `guildId`

This establishes a current participation surface. It does not create the Guildie or Subject.

### `guildie.left`

Published when a known Guildie moves from controlling at least one current roster Character to controlling zero.

Coordinates:

- `subjectId`
- `guildId`

A single Character leaving does not produce this publication when another currently controlled Character remains on the guild roster.

This is not a closeout state. The Guildie remains durable and recognizable; only current organizational membership, participation surface, and rank-derived authority are absent.

### `guildie.rank.changed`

Published when the Guildie's effective current guild rank changes.

Coordinates:

- `subjectId`
- `guildId`

Effective rank is the highest-authority rank among all currently controlled roster Characters. Under the current Blizzard rank ordering, the lower numeric `rank_index` has higher authority.

A Character rank change therefore does not necessarily produce a Guildie rank change.

## Reconciliation boundaries

Current Guildie organizational membership can change at two established reconciliation boundaries.

### Guild roster reconciliation

Guild roster reconciliation changes Blizzard-observed Character roster truth. Before and after Character roster state and derived Guildie roster state are compared inside the persistence transaction. Publications are transported only after that transaction succeeds.

A guild refresh that establishes no Character or Guildie transition publishes nothing. Presentation-coordinate changes remain recognition enrichment concerns rather than membership publications.

Character presentation enrichment remains downstream recognition enrichment and is not itself guild-membership truth.

### Subject character-control reconciliation

Subject establishment and refresh reconcile which Blizzard Characters the Subject currently controls. Character roster truth does not change at this boundary, so it does not produce `character.*` publications.

The changed control set can, however, change the Guildie's derived intersection with the current Character roster. Before and after Guildie state are therefore compared, and `guildie.joined`, `guildie.left`, or `guildie.rank.changed` is published when that derived truth changes.

A controlled non-guild Character appearing or disappearing produces no Guildie publication unless it changes that guild-relevant intersection.

At both boundaries, publication transport failure does not reverse successfully established authoritative state.
