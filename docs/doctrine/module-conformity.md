# Module Conformity

Guild Operations Modules own native, concrete guild participation capabilities. This doctrine defines the application-wide invariants every Module must respect regardless of semantic family. External-system integrations are separate from Modules and Activity plugins. They own procedure and reality belonging to the external system while participating in Guild Operations through contracts owned by the corresponding Guild Operations domains. An integration may consume Guild Operations truth or originate authenticated interactions without acquiring authority over the Guild Operations procedure those interactions invoke.

A module family may add stronger semantic governance. Guild Activity modules, for example, are additionally governed by [Guild Activity](guild-activity.md). Family doctrine does not transfer domain ownership into shared machinery.

## Domain ownership

A module owns the domain truth and procedure of the capability it establishes or operates.

A module may appear through shared discovery, administration, or projection surfaces without transferring its truth to those surfaces. The existence of multiple modules does not imply a generic module loader, lifecycle implementation, participation framework, registry, or superclass.

Shared abstractions emerge only from repeated concrete pressure.

## Application boundary

A module owns application operations for its authoritative behavior. Web, REST, Discord, and other interaction surfaces are adapters over those operations rather than independent owners of the same procedure. An external integration may be authoritative for provider-specific facts, including the external Identity through which an interaction originated, while Guild Operations remains authoritative for actor resolution and the receiving application procedure.

An adapter may translate representation, choose presentation language, and enforce surface-specific concerns, but it must not reconstruct module lifecycle, mutation rules, or authority that belongs to the application operation.

REST resource paths and web presentation paths are independent adapter concerns. REST exposes authoritative application subjects through machine-oriented resource paths. Web places the same subjects where humans naturally participate in or operate them. Neither route hierarchy is authoritative for the other.

## Shared infrastructure and projections

A module may express selected facts through shared infrastructure when that infrastructure has a legitimate cross-domain purpose. The module remains authoritative for its own truth, lifecycle where applicable, participation, operation, and history.

Shared infrastructure owns only the state and procedure belonging to its purpose. It must not acquire module authority merely because it consumes module queries or semantic emissions.

Projection guidance supplied by a module means that, if a consumer chooses to project an aspect, the module remains authoritative for the semantic value. The consumer owns arrangement and presentation.

## Participation, operations, and administration

Elevated authority does not determine information architecture. A module may expose participation, privileged operations, administrative configuration, or any combination of those roles.

**Participation** lets guild members take part in a Guild Activity and belongs with the Activity being participated in.

**Operations** let authorized members run, advance, adjudicate, reconcile, or resolve a concrete activity or process. Operations remain with the domain or process being operated. A capability does not become administrative merely because only privileged members may invoke it.

**Administration** configures how Guild Operations provides and governs capabilities. It owns durable application or module configuration, module lifecycle state where earned, and configurable authorization policy rather than ordinary privileged work.

> Authority controls access. It does not determine information architecture.

Module enablement is administrative state. Operational use of an enabled module remains module-owned. A module does not earn an administrative destination merely because it exists; it contributes only configuration or configurable permission policy that has actually been earned.

Capability lifecycle concepts remain distinct where they exist:

```text
availability / entitlement
        ↓
enablement
        ↓
configuration readiness
        ↓
operational use
```

Current behavior should model only states actually required by Guild Operations. Do not build speculative commerce, licensing, entitlement, administration, contribution, permission, module-lifecycle, or plugin-lifecycle frameworks merely because future machinery can be imagined.

## Persistence

A module owns durable facts established by its own procedure and references globally owned Guild Operations objects and observations rather than recreating them locally.

Shared storage does not transfer semantic ownership. A module contributing truth to shared infrastructure remains authoritative for the truth it contributed while the infrastructure owns only its own storage contract and procedure.

Derived global authority must not be duplicated as module-local truth merely to make module procedure convenient.

Application-wide persistence law is defined by [Architecture](architecture.md). Current persistence mechanics belong to infrastructure documentation.

## Permissioning

Modules consume globally authoritative member, roster, rank, and capability facts while owning permission policy specific to their procedure.

Do not duplicate global authority state merely to make a local authorization decision.

A module capability may exist without being administratively configurable. When the guild can configure module permission policy, that configuration belongs to the global Permissions concern while enforcement remains in backend authority and module procedure.

Capability names should describe concrete authority the module currently has. Changing an established machine capability key is consequential because persisted mappings may depend on it.

Current permission machinery is documented in [Guild Permissioning](../infrastructure/guild-permissioning.md).

## Presentation ownership

Presentation ownership follows semantic ownership. Shared application language belongs to global presentation machinery; reusable domain-specific expression belongs to its domain; exceptional one-off expression should not be promoted merely to manufacture reuse.

A module may establish semantic designation labels as useful defaults while allowing a projection to choose clearer local human-facing copy. Presentation may change expression, not the underlying fact or authority.

Current rendering and navigation mechanics belong in [Web Rendering](../infrastructure/web-rendering.md).

## General rule

Build the concrete capability first. Let common machinery reveal itself under real use.

When a module needs shared behavior, first ask which layer legitimately owns that behavior. Reuse follows ownership; ownership is not invented merely to create reuse.
