# Guild Permissioning

Guild Operations derives Guildie-facing authorization from current Blizzard Character roster membership, but Blizzard rank numbers are not themselves application permissions.

## Authority source

For a Guildie, effective guild authority is determined from Characters that are both:

- currently controlled by that Guildie, resolved through the durable Subject coordinate; and
- currently present in the configured Blizzard Character roster.

If more than one qualifying Character exists, the lowest Blizzard `rank_index` is the highest-authority membership and is used as the Guildie's effective guild rank.

If no controlled Character is currently on the Character roster, the Guildie remains durable and recognized but has no current guild participation surface and no rank-derived authority.

Selected main character is presentation state only and never participates in authorization.

## Rank definitions

`guild_rank_definitions` gives Blizzard rank indexes first-party presentation metadata. Rank indexes are the durable authority coordinate; display names are replaceable metadata.

Until the guild's real custom rank names are entered, observed ranks use explicit placeholders such as `Rank 0`, `Rank 1`, and so on. Guild roster synchronization creates definitions for newly observed ranks without overwriting an existing custom display name.

An unobserved rank can remain absent. In particular, rank 6 does not need to be manufactured merely because the numeric position exists.

## Capabilities

Application behavior authorizes against explicit capabilities rather than rank-number comparisons.

`guild_rank_capabilities` maps a guild rank definition to domain capabilities. Application machinery asks whether the operating Guildie possesses a capability; it does not ask whether the Guildie is, for example, rank 2 or better.

A rank's capability set is explicit. No implicit numeric inheritance is assumed by the permission resolver.

The effective authorization path is:

```text
Guildie's currently controlled Characters
        intersect
current Blizzard Character roster
        ↓
current Guildie participation surface
        ↓
highest-authority Blizzard rank
        ↓
GuildRankDefinition
        ↓
explicit capability grants
        ↓
authorization decision
```

The application session continues to resolve through `subject_id`; that coordinate identifies which Guildie is operating. Capabilities are derived from current backend truth and are not properties of Subject recognition itself.

This permits future changes to rank names and capability policy without changing Blizzard-derived Character roster facts or durable Guildie continuity.

## Current scope

This layer covers guild-rank-equivalent Guildie authorization only. System/operator authorization is intentionally outside the current scope.
