# Guild Permissioning

Guild Operations derives member-facing authorization from current Blizzard guild membership, but Blizzard rank numbers are not themselves application permissions.

## Authority source

For a Guild Operations subject, effective guild authority is determined from characters that are both:

- currently controlled by the subject, and
- currently present in the configured guild roster.

If more than one qualifying character exists, the lowest Blizzard `rank_index` is the highest-authority membership and is used as the subject's effective guild rank.

Selected main character is presentation state only and never participates in authorization.

## Rank definitions

`guild_rank_definitions` gives Blizzard rank indexes first-party presentation metadata. Rank indexes are the durable authority coordinate; display names are replaceable metadata.

Until the guild's real custom rank names are entered, observed ranks use explicit placeholders such as `Rank 0`, `Rank 1`, and so on. Guild roster synchronization creates definitions for newly observed ranks without overwriting an existing custom display name.

An unobserved rank can remain absent. In particular, rank 6 does not need to be manufactured merely because the numeric position exists.

## Capabilities

Application behavior authorizes against explicit capabilities rather than rank-number comparisons.

`guild_rank_capabilities` maps a guild rank definition to domain capabilities. Application machinery asks whether the subject possesses a capability; it does not ask whether the subject is, for example, rank 2 or better.

A rank's capability set is explicit. No implicit numeric inheritance is assumed by the permission resolver.

The effective authorization path is:

```text
current controlled characters
        intersect
current guild roster membership
        ↓
highest-authority Blizzard rank
        ↓
GuildRankDefinition
        ↓
explicit capability grants
        ↓
authorization decision
```

This permits future changes to rank names and capability policy without changing Blizzard-derived membership facts.

## Current scope

This layer covers guild-rank-equivalent authorization only. System/operator authorization is intentionally outside the current scope.
