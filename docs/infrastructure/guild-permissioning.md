# Guild Permissioning Infrastructure

This document describes the current shared machinery that translates established Guildie authority into globally owned application capabilities.

The authority derivation itself is doctrine defined in [`../doctrine/guild-authority.md`](../doctrine/guild-authority.md).

## Input

The permission layer receives the operating `guildie_id` and current effective guild authority from backend truth.

If the Guildie has no current participation surface, there is no rank-derived authority to translate. Selected main is never an authorization input.

Capabilities are derived at use time rather than embedded permanently in the Guildie or session.

## Rank definitions

`guild_rank_definitions` attaches Guild Operations metadata to Blizzard numeric rank indexes.

`rank_index` remains the authority coordinate. Display names and other Guild Operations presentation are mutable metadata.

Guild roster synchronization may establish definitions for newly observed ranks without overwriting configured metadata. The available rank space must not be inferred only from ranks occupied in one roster observation.

## Global capability mapping

`guild_rank_capabilities` maps rank definitions to globally owned capabilities.

```text
current Guildie effective authority
        ↓
Blizzard numeric rank
        ↓
GuildRankDefinition
        ↓
explicit global capability grants
        ↓
global authorization decision
```

Capability sets are explicit. The resolver does not assume implicit capability inheritance from numeric rank ordering.

## Operator authority

Guild Operations also has a deliberately separate operator authority seam for deployment ownership. The configured operator is identified by the durable Guildie coordinate supplied as `OPERATOR_GUILDIE_ID`.

Operator authority is not a synthetic guild rank and does not add entries to `guild_rank_capabilities`. It must not rewrite Blizzard-observed rank or membership facts. Procedures opt into operator override explicitly when deployment ownership needs to survive the guild's ordinary rank policy.

The Raid module currently opts into operator override for `raid.create`, `raid.manage`, and Raid permission administration. Its rank-mapping authority remains `raid.permissions`, granted only to Blizzard rank 0. The configured operator may perform that administration independently of current Raid rank grants.

This distinction is intentional:

```text
Blizzard rank authority
        → explicit guild capability grants

configured operator identity
        → explicit procedure-specific override
```

The operator seam is not an implicit superuser capability applied to every module or operation.

## Authorization and presentation

This infrastructure owns the authorization decision. Presentation infrastructure may hide, disable, label, or otherwise express an action according to the current authorized state, but presentation is never the enforcement boundary.

Routes and procedures that require a capability must enforce that requirement against backend authority regardless of whether the corresponding control is visible in the current interface. Shared presentation behavior is documented in [`web-rendering.md`](web-rendering.md).

## Module use

Modules may consume current global facts directly, require an existing global capability, or introduce module-specific permission state when a concrete procedure proves that additional state is necessary.

Using shared authorization machinery does not transfer module-specific policy to the global layer. Modules must not duplicate globally owned Guildie, Character, roster, rank, or authority state merely to evaluate local authorization.

## Current scope

This infrastructure covers rank-derived authorization and the minimal explicit operator identity seam. Module procedures remain responsible for deciding whether operator override is legitimate for their own operations.
