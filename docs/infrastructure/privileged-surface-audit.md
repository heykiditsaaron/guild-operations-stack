# Privileged Surface Audit

This document records the current privileged web surface inventory that motivated the separation of participation, operations, and administration.

The authoritative semantic distinction is defined in [`../doctrine/surface-roles.md`](../doctrine/surface-roles.md). This document describes current implementation pressure and migration ownership.

## Current global administration shell

`/admin` currently combines configuration, privileged operations, operational inspection entry, and module-owned destinations.

The shell currently treats any of the following as sufficient administrative availability:

- permission to manually refresh guild state;
- permission to inspect operational records;
- an authorized module administration destination.

That availability model is transitional because operational authority alone should not determine whether Administration exists for a viewer.

## Current surface classification

| Current surface or action | Current location | Classification | Intended ownership |
| --- | --- | --- | --- |
| Automatic guild refresh enablement and cadence | `/admin` | Administration | `Administration → General` |
| Manual guild refresh | `/admin` | Operation | Global guild operation entry, location still to be earned |
| Guild refresh status/result context | `/admin` | Operational support | Follow the guild refresh operation or inspection surface |
| Operational record inspection | `/admin/operations` | Operational inspection | Privileged operational support, not Administration |
| Raid rank permission mapping | `/admin/raid/permissions` | Administration | `Administration → Permissions → Raid` |
| Create raid | `/admin/raid` | Operation | Raid-owned operational surface |
| List raids for management | `/admin/raid` | Operation | Raid-owned operational surface |
| Manage raid participation/composition | `/admin/raid/:raidId` | Operation | Raid-owned operational surface |
| Create raffle round | `/admin/raffle` | Operation | Raffle-owned operational surface |
| Edit listed raffle round | `/admin/raffle/:roundId` | Operation | Raffle-owned operational surface |
| Open raffle round | `/admin/raffle` and round management | Operation | Raffle-owned operational surface |
| Adjudicate raffle claims | `/admin/raffle/:roundId` | Operation | Raffle-owned operational surface |
| Draw or cancel raffle round | `/admin/raffle` and round management | Operation | Raffle-owned operational surface |
| Discord module enablement | `/admin/discord` | Administration | `Administration → General → Modules/Discord` |
| Discord application credentials and server association | `/admin/discord` | Administration | `Administration → General → Discord` |
| Discord invite URL | `/admin/discord` | Administration | `Administration → General → Discord` |
| Discord linked-role and rank-role projection policy | `/admin/discord/role-maps` | Administration | `Administration → General → Discord` |
| Read/refresh available Discord roles | `/admin/discord/role-maps` | Operation supporting configuration | Remain contextual to Discord configuration or operation; do not define Administration availability |
| Discord projection reconciliation triggered by policy change | `/admin/discord` | Operational consequence of configuration | Configuration remains administrative; reconciliation evidence remains operational |

## Existing registration model

Modules currently publish an administrative destination through `registerModuleAdministrationDestination(...)`.

Current registered destinations are:

- Raffle → `/admin/raffle`;
- Discord → `/admin/discord`;
- Raid → `/admin/raid`.

This contract encodes the old assumption that a privileged module-owned surface is an administrative destination. It should remain in place only while current routes are migrated.

Do not replace it with a speculative generalized contribution registry. The new global General and Permissions surfaces should first be built from the concrete configuration and permission needs above; any shared contribution contract should be extracted only after those implementations demonstrate the required shape.

## Administration target

The stable global administration surface is:

```text
Administration
├── General
└── Permissions
```

General owns durable application/module configuration and module enablement. Permissions owns configurable authorization policy.

Optional modules may add relevant content within those concerns without changing the global navigation skeleton.

A module with no configuration or configurable permission policy does not need an administrative destination beyond any global module enablement control.

## Module lifecycle seam

The current product already proves that packaged code presence and enabled application behavior are different facts through the Discord packaged module.

The administration model should preserve these distinct meanings:

```text
available / entitled
        ↓
enabled
        ↓
configured
        ↓
usable
```

The immediate migration should implement only states required by current packaged modules. Future premium-module entitlement may determine availability later without coupling licensing to operational routes or procedures.

## Migration constraints

During migration:

- backend capability enforcement remains authoritative;
- route relocation must not weaken authorization;
- module-owned domain procedures remain module-owned;
- participation routes should not absorb privileged operation merely for route symmetry;
- Administration must not become a generic privileged-action dashboard;
- operational inspection must not determine Administration availability;
- module absence or disablement should remove module participation/operation/configuration contributions as appropriate without changing the stable Administration structure.

## Unresolved operational placement

Two global operational concerns deliberately remain unresolved until domain migrations provide more pressure:

1. manual guild refresh entry;
2. operational inspection entry.

Their semantic classification is settled, but their final navigation location is not. Do not create a global Operations framework solely to house them.
