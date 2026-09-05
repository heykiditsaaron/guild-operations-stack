# Guild Permissioning

Guild Operations derives Guildie-facing authority from current Blizzard Character roster membership, but Blizzard rank numbers are not themselves application permissions.

This document describes globally owned guild authority facts and globally owned permission provisioning. Module-specific permission policy remains owned by the module that defines the participation procedure.

## Authority source

For a Guildie, effective guild authority is determined from Characters that are both:

- currently controlled by that Guildie; and
- currently present in the configured Blizzard Character roster.

The durable `guildie_id` identifies the operating Guildie. There is no intermediate persisted Subject coordinate.

If more than one qualifying Character exists, the lowest Blizzard `rank_index` is the highest-authority membership and is used as the Guildie's effective guild rank.

If no controlled Character is currently on the Character roster, the Guildie remains durable and recognized but has no current guild participation surface and no rank-derived authority.

Selected main character is presentation state only and never participates in authorization.

## Rank definitions

`guild_rank_definitions` gives Blizzard rank indexes first-party presentation metadata. Rank indexes are the durable authority coordinate; display names are replaceable metadata.

Until the guild's real custom rank names are entered, observed ranks use explicit placeholders such as `Rank 0`, `Rank 1`, and so on. Guild roster synchronization creates definitions for newly observed ranks without overwriting an existing custom display name.

An unobserved rank can remain absent. In particular, rank 6 does not need to be manufactured merely because the numeric position exists.

## Global capabilities

Globally owned Guild Operations behavior may authorize against explicit global capabilities rather than embedding rank-number comparisons throughout application code.

`guild_rank_capabilities` maps a guild rank definition to globally owned capabilities. Global application machinery may ask whether the operating Guildie possesses one of those capabilities rather than asking whether the Guildie is, for example, rank 2 or better.

A rank's global capability set is explicit. No implicit numeric inheritance is assumed by the global permission resolver.

The global capability path is:

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
explicit global capability grants
        ↓
global authorization decision
```

The application session resolves to `guildie_id`. Global capabilities are derived from current backend truth and are not permanent properties of the Guildie or session.

This permits future changes to rank names and global capability policy without changing Blizzard-derived Character roster facts or durable Guildie continuity.

## Module permission policy

Modules consume globally authoritative Guildie, Character, roster, rank, and other authority facts as inputs to their own participation procedures.

A module owns permission policy that is specific to that module. It may derive a module-specific authorization decision directly from current global facts, require an existing globally owned capability, or introduce module-specific permission state if a concrete module requirement proves that additional state is needed.

A module-specific capability does not become a global capability merely because it has a capability name. Module policy does not need to be persisted in `guild_rank_capabilities` when the module can evaluate that policy directly from current authoritative facts.

`raffle.admin` is a current concrete example. The capability and the policy that grants it belong to the Raffle module because they authorize raffle-specific procedure. Raffle derives that decision from globally owned effective guild-rank truth. The current implementation still provisions `raffle.admin` through the global `guild_rank_capabilities` machinery; that implementation path is conformity debt, not a transfer of permission-policy ownership to the global layer.

Global and module-specific permissioning may coexist. Ownership determines which layer defines and provisions the permission rule.

Modules should not duplicate globally owned Guildie, Character, roster, rank, or authority state in order to evaluate local authorization. Conversely, the global permission layer should not accumulate module-specific policy merely because it already provides reusable authorization machinery.

`Subject` is not an authority object. If ordinary language calls some object the subject of an authorization question, that designation is contextual and creates no persistence or permission semantics of its own.

## Current scope

The global permissioning layer covers guild-rank-equivalent authorization for globally owned Guild Operations behavior. System/operator authorization is intentionally outside the current scope.

Module-specific authorization is defined by each module and is documented with that module's participation procedure.
