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

The shell is still transitional in two ways:

- manual guild refresh and operational inspection can still contribute to Administration availability;
- legacy module administration destinations remain for modules whose privileged surfaces have not yet been separated.

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
| Manage raid participation/composition | `/admin/raid/:raidId` | Operation | Raid-owned operational surface; route migration still pending |
| Create raffle round | `/admin/raffle` | Operation | Raffle-owned operational surface |
| Edit listed raffle round | `/admin/raffle/:roundId` | Operation | Raffle-owned operational surface |
| Open raffle round | `/admin/raffle` and round management | Operation | Raffle-owned operational surface |
| Adjudicate raffle claims | `/admin/raffle/:roundId` | Operation | Raffle-owned operational surface |
| Draw or cancel raffle round | `/admin/raffle` and round management | Operation | Raffle-owned operational surface |
| Discord module enablement | `/admin/general` | Administration | `Administration → General → Modules` |
| Discord application credentials and server association | `/admin/discord` | Administration | `Administration → General → Discord` |
| Discord invite URL | `/admin/discord` | Administration | `Administration → General → Discord` |
| Discord linked-role and rank-role projection policy | `/admin/discord/role-maps` | Administration | `Administration → General → Discord` |
| Read/refresh available Discord roles | `/admin/discord/role-maps` | Operation supporting configuration | Remain contextual to Discord configuration or operation; do not define Administration availability |
| Discord projection reconciliation triggered by policy change | `/admin/discord` | Operational consequence of configuration | Configuration remains administrative; reconciliation evidence remains operational |

Legacy `/admin/raid` now redirects to the Raid-owned operational overview. Legacy `/admin/raid/permissions` redirects to the global Raid permission editor. Compatibility POST routes remain temporarily while existing browser scripts are migrated.

## Existing registration model

Modules historically published an administrative destination through `registerModuleAdministrationDestination(...)`.

Raid no longer publishes its operational surface through this registry. Raid permission administration is recognized directly as a global Administration concern instead.

Remaining legacy registrations are:

- Raffle → `/admin/raffle`;
- Discord → `/admin/discord`.

These registrations remain only while their current surfaces are separated. Do not add new entries or replace this registry with a speculative generalized contribution framework.

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
- module lifecycle changes must not create new dependencies on legacy Calendar machinery.

## Unresolved operational placement

Two global operational concerns deliberately remain unresolved until domain migrations provide more pressure:

1. manual guild refresh entry;
2. operational inspection entry.

Their semantic classification is settled, but their final navigation location is not. Do not create a global Operations framework solely to house them.
