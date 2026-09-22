# Privileged Surface Audit

This document records the privileged web surface inventory that motivated the separation of participation, operations, and administration, plus the current migration state.

The authoritative semantic distinction is defined in [`../doctrine/module-conformity.md`](../doctrine/module-conformity.md).

## Current global administration shell

Administration has stable global concerns:

```text
Administration
├── General
└── Permissions
```

Administration availability is now based on configuration authority rather than privileged operational authority.

Global operational work that does not belong to a particular activity is exposed separately through `/operations`.

## Current surface classification

| Surface or action | Current location | Classification | Ownership |
| --- | --- | --- | --- |
| Packaged module enablement | `/admin/general` | Administration | `Administration → General` |
| Automatic guild refresh enablement and cadence | `/admin/general` | Administration | `Administration → General` |
| Manual guild refresh | `/operations` | Operation | Global Operations |
| Guild refresh status/result context | `/operations` | Operational support | Global Operations |
| Operational record inspection | `/operations` | Operational inspection | Global Operations |
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
| Read/refresh available Discord roles | `/admin/general/discord/role-maps` | Operation supporting configuration | Contextual to Discord configuration |
| Discord projection reconciliation triggered by policy change | Discord configuration save | Operational consequence of configuration | Contextual consequence of Discord policy change |

Raid and Raffle operational navigation uses each module's canonical destinations. Current consumers must not reconstruct historical `/admin/...` or `/events/.../admin` operation coordinates; the module-owned destination is the single source of truth for where a concrete activity is operated.

Legacy `/admin/discord` and `/admin/discord/role-maps` redirect to their canonical General Administration coordinates. Current Discord browser actions use `/admin/general/discord` directly.

Legacy `/admin/operations` redirects to `/operations`.

Authorized Raid and Raffle operators discover their operational surfaces contextually from `/events`. Global Operations is exposed from the Me menu only when the viewer may perform the manual guild refresh or inspect operational records.

## Global Operations

The global `/operations` surface is concrete rather than framework-driven. It currently exists because two independent global operational needs have been proven:

- manually reconcile guild authority from Blizzard;
- inspect recorded operational results and exceptions.

It is not a generic event, task, command, or module-operation registry. Module-owned operations remain with their domains.

Automatic guild refresh remains Administration because cadence is durable policy. Manual guild refresh is Operations because it performs the procedure immediately.

Those two meanings now have separate capabilities:

- `guild.refresh` — perform an immediate guild refresh;
- `guild.refresh.schedule.configure` — configure automatic refresh policy.

They currently seed to the same existing privileged guild ranks, preserving current authority while keeping the concepts independent for future policy changes.

## Legacy destination registry

The historical `registerModuleAdministrationDestination(...)` registry has been removed.

It encoded the old assumption that privileged module-owned surfaces needed to publish themselves as Administration destinations. Concrete pressure resolved the three existing cases without a replacement generic registry:

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
- global Operations must not become a generic module-operation registry;
- module lifecycle changes must not create new dependencies on legacy Calendar machinery;
- Raid and Raffle consumers must use module-owned destinations rather than compatibility operation routes or independently reconstructed URLs;
- application/domain operations must remain endpoint-agnostic so later HTTP contract changes do not become domain migrations.
