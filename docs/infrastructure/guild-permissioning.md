# Guild Permissioning

Blizzard numeric guild rank is an authority input, not itself a Guild Operations permission.

This document owns the translation from established current Guildie authority into globally owned application capabilities, and the boundary between global permissioning and module-specific permission policy.

Current Guildie participation and effective rank are derived by the contract in [`guild-authority.md`](guild-authority.md). Permissioning consumes that result rather than redefining the account-control ∩ roster derivation.

## Authority input

The permission layer receives the operating `guildie_id` and current effective guild authority from backend truth.

If the Guildie has no current participation surface, there is no rank-derived authority to translate. Selected main is presentation state only and never participates in authorization.

Capabilities are derived at use time from current authoritative state; they are not permanent properties embedded in the Guildie or application session.

## Rank definitions

`guild_rank_definitions` gives Blizzard numeric rank indexes first-party Guild Operations metadata.

The numeric `rank_index` remains the durable authority coordinate. Display names and other first-party presentation are mutable metadata.

Guild roster synchronization may establish definitions for newly observed ranks without overwriting existing configured metadata. The available rank space must not be inferred solely from whichever ranks are populated in one roster observation.

## Global capabilities

Globally owned Guild Operations behavior may authorize against explicit capabilities rather than scattering numeric-rank comparisons throughout application code.

`guild_rank_capabilities` maps a guild rank definition to globally owned capabilities.

The global permission path is:

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

A rank's global capability set is explicit. The global permission resolver does not assume implicit numeric capability inheritance merely because lower rank indexes currently represent higher guild authority.

This permits rank presentation and capability policy to change without rewriting Blizzard roster facts, Guildie continuity, or application sessions.

## Module permission policy

Modules consume globally authoritative Guildie, Character, roster, rank, capability, and other shared authority facts as inputs to their own procedures.

A module owns permission policy that is specific to that module. It may:

- derive a module-specific authorization decision directly from current global facts;
- require an existing globally owned capability; or
- introduce module-specific permission state if a concrete procedure proves that additional state is necessary.

A module-specific capability does not become globally owned merely because it has a capability name. Likewise, use of shared authorization machinery does not transfer ownership of module policy to the global layer.

Global and module-specific permissioning may coexist. Semantic ownership determines which layer defines the rule.

Modules must not duplicate globally owned Guildie, Character, roster, rank, or authority state merely to evaluate local authorization. Conversely, the global permission layer must not accumulate module-specific policy simply because it already offers reusable machinery.

## Subject boundary

`Subject` is not an authority or permission object. If ordinary language identifies some object as the subject of an authorization question, that contextual role creates no persistence or permission semantics.

## Current scope

The global permissioning layer covers rank-derived authorization for globally owned Guild Operations behavior.

System/operator authorization is intentionally outside the current scope. Module-specific authorization remains owned by the corresponding module procedure.
