# Privileged Surface Audit

This document records the privileged web surface inventory that motivated the separation of participation, operations, and administration, plus the current migration state.

The authoritative semantic distinction is defined in [`../doctrine/surface-roles.md`](../doctrine/surface-roles.md).

## Current global administration shell

Administration now has stable global concerns:

```text
Administration
├── General
└── Permissions
```

The remaining transitional pressure is global rather than module-specific:

- manual guild refresh still lives inside General even though the immediate refresh action is operational;
- operational inspection still contributes to Administration availability and remains under `/admin/operations`.

Those are migration conditions, not the target information architecture.

## Current surface classification

| Surface or action | Current location | Classification | Intended ownership |
| --- | --- | --- | --- |
| Packaged module enablement | `/admin/general` | Administration | `Administration → General` |
| Automatic guild refresh enablement and cadence | `/admin/general` | Administration | `Administration → General` |
| Manual guild refresh | `/admin/general` | Operation | Global guild operation entry, location still to be earned |
| Guild refresh status/result context | `/admin/general` | Operational support | Follow the guild refresh operation or inspection surface |
| Operational record inspection | `/admin/operations` | Operational inspection | Privileged operational support, not Administration |
| Raid rank permission mapping | `/admin/permissions/raid` | Administration | `Administration → Permissions → Raid` |
| Create raid | `/events/raid/manage` | Operation | Raid-owned operational surface |
| List raids for management | `/events/raid/manage` | Operation | Raid-owned operational surface |
| Manage raid participation/composition | `/events/raid/manage/:raidId` | Operation | Raid-owned operational surface |
| Create raffle round | `/events/raffle/manage` | Operation | Raffle-owned operational surface |
| Edit listed raffle round | `/events/raffle/manage/:roundId` | Operation | Raffle-owned operational surface |
| Open raffle round | `/events/raffle/manage` and round management | Operation | Raffle-owned operational surface |
| Adjudicate raffle claims | `/events/raffle/manage/:roundId` | Operation | Raffle-owned operational surface |
| Draw or cancel raffle round | `/events/raffle/manage` and round management | Operation | Raffle-owned operational surface |
| Discord module enablement | `/admin/general` | Administration | `Administration → General → Modules` |
| Discord application credentials and server association | `/admin/general/discord` | Administration | `Administration → General → Discord` |
| Discord invite URL | `/admin/general/discord` | Administration | `Administration → General → Discord` |
| Discord linked-role and rank-role projection policy | `/admin/general/discord/role-maps` | Administration | `Administration → General → Discord` |
| Read/refresh available Discord roles | `/admin/general/discord/role-maps` | Operation supporting configuration | Remain contextual to Discord configuration; do not define Administration availability |
| Discord projection reconciliation triggered by policy change | Discord configuration save | Operational consequence of configuration | Configuration remains administrative; reconciliation evidence remains operational |

Legacy `/admin/raid` redirects to the Raid-owned operational overview. Legacy `/admin/raid/:raidId` redirects to the Raid-owned organizer. Legacy `/admin/raid/permissions` redirects to the global Raid permission editor. Compatibility POST routes remain temporarily for old clients, but current Raid browser flows use the canonical Raid-owned operational routes.

Legacy `/admin/raffle` and `/admin/raffle/:roundId` redirect to the Raffle-owned operational surfaces. The previous `/events/raffle/admin` aliases also redirect to the same canonical operational coordinates. Current Raffle browser navigation uses `/events/raffle/manage...` directly.

Legacy `/admin/discord` and `/admin/discord/role-maps` redirect to their canonical General Administration coordinates. Current Discord browser actions use `/admin/general/discord` directly.

Authorized Raid and Raffle operators discover their operational surfaces contextually from `/events`. Neither module publishes its operational surface as an Administration destination.

## Legacy destination registry

The historical `registerModuleAdministrationDestination(...)` registry has been removed.

It encoded the old assumption that privileged module-owned surfaces needed to publish themselves as Administration destinations. Concrete pressure has now resolved the three existing cases without a replacement generic registry:

- Raid contributes configurable policy to `Administration → Permissions` while Raid operations remain Raid-owned;
- Raffle currently contributes only packaged-module enablement to `Administration → General`, while Raffle operations remain Raffle-owned;
- Discord contributes durable configuration to `Administration → General`.

Do not recreate a generic module-administration destination or contribution framework unless multiple future features prove a concrete shared contract that cannot remain explicit.

## Administration target

General owns durable application/module configuration and module enablement. Permissions owns configurable authorization policy.

Optional modules may add relevant content within those concerns without changing the global navigation skeleton.

A module with no configuration or configurable permission policy does not need an administrative destination beyond any global module enablement control.

## Module lifecycle seam

The current product already proves that packaged code presence and enabled application behavior are different facts through the Discord packaged module.

The administration model preserves these distinct meanings:

```text
available / entitled
        ↓
enabled
        ↓
configured
        ↓
usable
```

The current implementation establishes packaged-module enablement only. Future premium-module entitlement may determine availability later without coupling licensing to operational routes or procedures.

The legacy Calendar remains outside this lifecycle migration and will be handled by its dedicated redesign.

## Migration constraints

During migration:

- backend capability enforcement remains authoritative;
- route relocation must not weaken authorization;
- module-owned domain procedures remain module-owned;
- participation routes should not absorb privileged operation merely for route symmetry;
- Administration must not become a generic privileged-action dashboard;
- operational inspection must not determine Administration availability in the final model;
- module lifecycle changes must not create new dependencies on legacy Calendar machinery;
- legacy web routes are temporary migration scaffolding rather than durable endpoint contracts and should be deleted once all current callers use canonical routes;
- application/domain operations must remain endpoint-agnostic so later HTTP contract changes do not become domain migrations.

## Unresolved operational placement

Two global operational concerns deliberately remain unresolved until domain migrations provide more pressure:

1. manual guild refresh entry;
2. operational inspection entry.

Their semantic classification is settled, but their final navigation location is not. Do not create a global Operations framework solely to house them.
