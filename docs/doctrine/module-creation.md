# Module Design Guidance

Guild Operations modules should be built around **concrete guild participation or operation capabilities**, not generalized framework machinery.

A module should establish or operate a real guild activity, preserve its history, or provide authority needed to participate in it. Shared abstractions should emerge from repeated real pressure rather than being designed in advance.

## Source ownership

Concrete capability modules belong under `src/modules/<module>/` once the application has earned a module boundary for that capability.

Source ownership does not need to mirror member-facing route hierarchy. A module may appear under `/events` without being owned by a shared Events surface and may contribute to shared projections without transferring its domain truth to those surfaces.

The `src/modules/` container does not imply a generic module loader, event lifecycle, participation lifecycle, registry, or framework.

## Application boundary

A module owns application operations for the behavior it establishes. Web routes, REST routes, Discord, and other interaction surfaces are adapters over those operations rather than independent owners of the same procedure.

An adapter may translate representation, choose presentation language, and enforce surface-specific concerns, but it should not reconstruct module lifecycle, mutation rules, or authority that belongs to the application operation.

Raid and Raffle are the first paired reference implementations of this shape. Their concrete contracts are documented in [`../features/raid.md`](../features/raid.md) and [`../raffle.md`](../raffle.md). Treat their common boundaries as proven vocabulary to pressure-test against and their differences as evidence of module ownership, not as a generic event superclass or workflow that later modules must imitate.

## Shared projections

A module may express selected facts through shared infrastructure when that infrastructure has a legitimate cross-module consumer. The module remains authoritative for its own lifecycle, participation, operation, and history.

A module-owned event can therefore establish its own listing and destinations while separately publishing the smaller representation a shared discovery surface needs. Shared projections must not become alternate owners of module state.

Current event-publication and Calendar machinery is still evolving. Do not use legacy Calendar or publication shapes as doctrine for new module design. When those shared contracts are rebuilt, pressure them against the concrete module contracts that now exist rather than making modules conform to obsolete discovery machinery.

Do not put rules, eligibility, administration, history, or module procedure into a shared projection merely because a shared interface could carry them.

## Participation, operations, and administration

A module may expose participation, privileged operations, administrative configuration, or any combination of those roles. The distinctions are defined in [`surface-roles.md`](surface-roles.md).

Do not classify a module-owned surface as Administration merely because it requires elevated authority.

- Participation stays with the activity being participated in.
- Operations stay with the activity or process being operated.
- Administration owns durable configuration, module lifecycle state, and configurable permission policy.

Administration has stable global concerns rather than one top-level destination per module:

```text
Administration
├── General
└── Permissions
```

A module contributes only configuration or configurable permission policy it has actually earned. A module with no such state does not need an administrative destination merely because it exists or has privileged operators.

Module enablement is administrative state. Operational use of an enabled module remains module-owned.

Do not introduce a generic module administration registry, event lifecycle framework, entitlement system, participation framework, or contribution framework before multiple concrete modules demonstrate the required contract. Current packaged-module behavior may establish the smallest useful seam first; future entitlement or premium distribution must remain independent from operational procedure.

## Participation behavior

Participation is module-defined. A participation event establishes what member action constitutes participation, what authority governs any intermediate organization or judgment, and what evidence Guild Operations can legitimately preserve.

A **participation commitment** is a participant-authored expression of intent to participate. The participant is authoritative for making that commitment, but the commitment does not automatically prove that later participation occurred. A module may require further human or mechanical procedure before the commitment establishes participation, or the commitment itself may be the act of participation.

Raid and Raffle demonstrate the first shape without sharing a workflow. A Raid signup is a commitment describing what an applicant is willing to bring; an operator assignment establishes the accepted roster configuration. A Raffle claim is a commitment to enter and provide the corresponding gold; operator verification and approval establish drawing weight. Their later execution differs again: Raid is performed socially by humans, while Raffle consumes established drawing weight mechanically.

Other activities can collapse those boundaries. In Hidden in Plain Sight, a submission is both the participation commitment and the participation itself; later operator adjudication determines whether that participation succeeded rather than whether it occurred.

These distinctions are vocabulary, not framework machinery. They do not establish a generic participation table, commitment model, state machine, adjudication service, assignment model, or authorization contract. Participation windows, withdrawal rules, establishment procedure, execution, success, and historical evidence remain module behavior until repeated concrete modules prove a narrower shared abstraction.

Software must not promote intent into observed participation merely because it has a commitment record. Where actual participation is only knowable after the activity, Guild Operations should preserve the strongest fact its authority and evidence legitimately establish.

## Persistence

A module owns persistence for the participation or operation truth it establishes. It must not duplicate globally owned Guild Operations truth.

Application-wide persistence ownership is defined in [`global-persistence.md`](global-persistence.md). Current member reconciliation mechanics are infrastructure documented in [`../infrastructure/persistence-boundary.md`](../infrastructure/persistence-boundary.md).

## Permissioning

Modules consume globally authoritative member, roster, rank, and capability facts while owning permission policy specific to their own procedure.

Do not duplicate global authority state merely to make a local authorization decision. Current shared permission machinery is documented in [`../infrastructure/guild-permissioning.md`](../infrastructure/guild-permissioning.md).

A module capability may exist without being administratively configurable. When the guild is allowed to configure module permission policy, that configuration belongs to the global Permissions concern while enforcement remains in backend authority and module procedure.

Capability names should describe concrete authority the module currently has. When a module's lifecycle changes, update human-facing capability metadata to match the authority that remains. Treat changing an established machine capability key separately because persisted rank mappings may depend on it.

## Rendering

Rendering ownership follows semantic ownership:

1. **Global rendering** when presentation belongs to the shared application language.
2. **Module rendering** when reusable presentation belongs specifically to that module.
3. **Inline rendering** when a surface is genuinely exceptional and has no demonstrated reusable owner.

Do not promote one-off presentation merely to create reuse, and do not duplicate globally owned shell or navigation behavior inside modules. Current rendering infrastructure is documented in [`../infrastructure/web-rendering.md`](../infrastructure/web-rendering.md).

A module may establish semantic designation labels as useful defaults while allowing a projection to choose clearer local human-facing copy. Presentation may change expression, not the underlying fact or authority.

## General guidance

Build the guild activity first. Let common machinery reveal itself under real use.

Prepare inexpensive semantic seams for likely future expression when justified, but do not create speculative frameworks around them.

When a module needs shared behavior, first ask which layer legitimately owns that behavior. Reuse should follow ownership; ownership should not be invented merely to create reuse.
