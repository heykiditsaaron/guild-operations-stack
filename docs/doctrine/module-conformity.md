# Module Conformity

Guild Operations modules own concrete guild capabilities. This doctrine defines the application-wide invariants a module must respect regardless of what semantic family it belongs to.

A module family may add stronger semantic governance. Guild Activity modules, for example, are additionally governed by [Guild Activity](guild-activity.md). Family doctrine does not transfer domain ownership into shared machinery.

## Domain and source ownership

A module owns the domain truth and procedure of the capability it establishes or operates.

Concrete capability modules belong under `src/modules/<module>/` once the application has earned a module boundary for that capability. Source ownership does not need to mirror member-facing route hierarchy. A module may appear under `/events` or contribute to shared projections without transferring its truth to those surfaces.

The `src/modules/` container does not imply a generic module loader, lifecycle implementation, participation framework, registry, or superclass. Shared abstractions emerge only from repeated concrete pressure.

## Application boundary

A module owns application operations for its authoritative behavior. Web, REST, Discord, and other interaction surfaces are adapters over those operations rather than independent owners of the same procedure.

An adapter may translate representation, choose presentation language, and enforce surface-specific concerns, but it must not reconstruct module lifecycle, mutation rules, or authority that belongs to the application operation.

REST resource paths and web presentation paths are independent adapter concerns. REST exposes authoritative application subjects through machine-oriented resource paths. Web places the same subjects where humans naturally participate in or operate them. Neither route hierarchy is authoritative for the other.

Raid and Raffle demonstrate this boundary: machine resources and human Events routes meet at the owning application contract rather than at URL conventions.

## Shared infrastructure and projections

A module may express selected facts through shared infrastructure when that infrastructure has a legitimate cross-domain purpose. The module remains authoritative for its own truth, lifecycle where applicable, participation, operation, and history.

Shared infrastructure owns only the state and procedure belonging to its purpose. It must not acquire module authority merely because it consumes module queries or semantic emissions.

Projection guidance supplied by a module means that, if a consumer chooses to project an aspect, the module remains authoritative for the semantic value. The consumer owns arrangement and presentation.

## Participation, operations, and administration

A module may expose participation, privileged operations, administrative configuration, or any combination of those roles. The distinctions are defined in [Surface Roles](surface-roles.md).

Do not classify a module-owned surface as Administration merely because it requires elevated authority.

- Participation stays with the activity being participated in.
- Operations stay with the activity or process being operated.
- Administration owns durable configuration, module lifecycle state, and configurable permission policy.

Module enablement is administrative state. Operational use of an enabled module remains module-owned.

Do not introduce generic administration, entitlement, participation, contribution, or lifecycle frameworks before multiple concrete modules demonstrate the required contract.

## Persistence

A module owns persistence for the domain truth it establishes and must not duplicate globally owned Guild Operations truth.

Application-wide persistence ownership is defined in [Global Persistence](global-persistence.md). Current member reconciliation mechanics are infrastructure documented in [Persistence Boundary](../infrastructure/persistence-boundary.md).

## Permissioning

Modules consume globally authoritative member, roster, rank, and capability facts while owning permission policy specific to their procedure.

Do not duplicate global authority state merely to make a local authorization decision. Shared permission machinery is documented in [Guild Permissioning](../infrastructure/guild-permissioning.md).

A module capability may exist without being administratively configurable. When the guild can configure module permission policy, that configuration belongs to the global Permissions concern while enforcement remains in backend authority and module procedure.

Capability names should describe concrete authority the module currently has. Changing an established machine capability key is consequential because persisted mappings may depend on it.

## Rendering

Rendering ownership follows semantic ownership:

1. global rendering when presentation belongs to the shared application language;
2. module rendering when reusable presentation belongs specifically to that module;
3. inline rendering when a surface is genuinely exceptional and has no demonstrated reusable owner.

Do not promote one-off presentation merely to create reuse, and do not duplicate globally owned shell or navigation behavior inside modules. Current rendering infrastructure is documented in [Web Rendering](../infrastructure/web-rendering.md).

A module may establish semantic designation labels as useful defaults while allowing a projection to choose clearer local human-facing copy. Presentation may change expression, not the underlying fact or authority.

## General rule

Build the concrete capability first. Let common machinery reveal itself under real use.

When a module needs shared behavior, first ask which layer legitimately owns that behavior. Reuse follows ownership; ownership is not invented merely to create reuse.
