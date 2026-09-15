# Guild Permissioning Infrastructure

This document describes the shared machinery that translates established Guildie authority into globally owned application capabilities.

The authority derivation itself is doctrine defined in [`../doctrine/guild-authority.md`](../doctrine/guild-authority.md).

## Input

The permission layer receives the operating `guildie_id` and current effective guild authority from backend truth. If the Guildie has no current participation surface, there is no rank-derived authority to translate. Selected main is never an authorization input.

Capabilities are derived at use time rather than embedded permanently in the Guildie or session.

## Rank definitions

`guild_rank_definitions` attaches Guild Operations metadata to Blizzard numeric rank indexes. `rank_index` remains the authority coordinate. Display names and other Guild Operations presentation are mutable metadata.

Guild roster synchronization may establish definitions for newly observed ranks without overwriting configured metadata. The available rank space must not be inferred only from ranks occupied in one roster observation.

## Capability contract

Capability keys are authoritative machine identifiers. They use stable dotted vocabulary such as `raid.create`. Human-readable labels, descriptions, and namespace labels are projection metadata only; changing that metadata does not change authority, persistence, or module consumption.

Global machinery and modules may register configurable capability definitions. A definition contributes the capability key and descriptive metadata only. It does not contribute Administration routes, HTML, CSS, controls, or rank-selector behavior.

The registration seam is intentionally application-facing rather than web-facing. The same capability-policy service can therefore support later application/API contracts without making the current Administration page authoritative for permission state.

## Global capability mapping

`guild_rank_capabilities` maps rank definitions to capabilities:

```text
current Guildie effective authority
        ↓
Blizzard numeric rank
        ↓
explicit capability grants
        ↓
global authorization decision
```

Capability sets are explicit. The resolver does not assume implicit capability inheritance from numeric rank ordering. A configurable capability's policy is therefore the explicit array of permitted Blizzard rank indexes.

Global permission policy machinery owns reading and replacing those rank arrays. Modules consume the resulting global authority rather than maintaining their own rank maps.

## Permission administration root authority

Permission administration is deliberately not another configurable capability. It has two roots:

- current Blizzard Guild Master rank `0` may administer capability-to-rank policy innately;
- the configured deployment operator may administer it through the separate operator authority seam.

No editable capability grant can remove rank 0's ability to administer permission policy or manufacture that root authority for another rank.

## Operator authority

Guild Operations has a deliberately separate operator authority seam for deployment ownership. The configured operator is identified by the durable Guildie coordinate supplied as `OPERATOR_GUILDIE_ID`.

Operator authority is not a synthetic guild rank and does not add entries to `guild_rank_capabilities`. It must not rewrite Blizzard-observed rank or membership facts. Procedures opt into operator override explicitly when deployment ownership needs to survive ordinary guild rank policy.

The operator seam is not an implicit superuser capability applied to every module or operation.

## Administration projection

`/admin/permissions` is a global projection of registered configurable capability policy. Global Administration owns its rendering, styling, grouping, and rank-selection behavior. Capabilities are grouped by their registered namespace and shown using descriptive metadata while the dotted capability key remains intact underneath.

The page keeps each capability compact until its rank checklist is expanded. This is presentation only; the persisted authority remains the explicit capability-to-rank mapping.

Presentation is never the enforcement boundary. Routes and procedures that require a capability must enforce that requirement against backend authority regardless of whether the corresponding control is visible.

## Module use

A module owns the meaning of the capabilities its domain requires. When a module needs configurable rank-derived authority, it registers the authoritative key and human projection metadata with the global capability-policy machinery. Global machinery owns persistence and Administration projection.

A module does not register a permission page and does not own a parallel rank-permission table. It consumes global capability authority, or may retrieve the configured permitted-rank array through the application-facing policy service when that contract is useful.

This does not require every module to contribute capabilities. A module contributes only concrete authority its real procedures have earned.
