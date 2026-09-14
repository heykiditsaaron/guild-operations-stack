# Module Design Guidance

Guild Operations modules should be built around **concrete guild participation or operation capabilities**, not generalized framework machinery.

A module should establish or operate a real guild activity, preserve its history, or provide authority needed to participate in it. Shared abstractions should emerge from repeated real pressure rather than being designed in advance.

## Source ownership

Concrete capability modules belong under `src/modules/<module>/` once the application has earned a module boundary for that capability.

Source ownership does not need to mirror member-facing route hierarchy. A module may appear under `/events` without being owned by Guild Events and may contribute to shared discovery surfaces without transferring its domain truth to those surfaces.

The `src/modules/` container does not imply a generic module loader, lifecycle, registry, or framework.

## Shared infrastructure

A module should consume shared infrastructure only for responsibilities that infrastructure genuinely owns.

For Guild Events, distinguish:

```text
Guild Event Offering
    → What participation does the guild offer?

Guild Event Calendar Listing
    → What concrete occurrence happens when?

Module destination
    → What is this activity, and how does participation work?
```

Current usage contracts live in [`../infrastructure/guild-event-offerings.md`](../infrastructure/guild-event-offerings.md) and [`../infrastructure/guild-event-calendar.md`](../infrastructure/guild-event-calendar.md).

Do not put rules, eligibility, administration, history, or module procedure into shared discovery projections merely because a shared interface consumes them.

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

Do not introduce a generic module administration registry, lifecycle framework, entitlement system, or contribution framework before multiple concrete modules demonstrate the required contract. Current packaged-module behavior may establish the smallest useful seam first; future entitlement or premium distribution must remain independent from operational procedure.

## Persistence

A module owns persistence for the participation or operation truth it establishes. It must not duplicate globally owned Guild Operations truth.

Application-wide persistence ownership is defined in [`global-persistence.md`](global-persistence.md). Current member reconciliation mechanics are infrastructure documented in [`../infrastructure/persistence-boundary.md`](../infrastructure/persistence-boundary.md).

## Permissioning

Modules consume globally authoritative member, roster, rank, and capability facts while owning permission policy specific to their own procedure.

Do not duplicate global authority state merely to make a local authorization decision. Current shared permission machinery is documented in [`../infrastructure/guild-permissioning.md`](../infrastructure/guild-permissioning.md).

A module capability may exist without being administratively configurable. When the guild is allowed to configure module permission policy, that configuration belongs to the global Permissions concern while enforcement remains in backend authority and module procedure.

## Rendering

Rendering ownership follows semantic ownership:

1. **Global rendering** when presentation belongs to the shared application language.
2. **Module rendering** when reusable presentation belongs specifically to that module.
3. **Inline rendering** when a surface is genuinely exceptional and has no demonstrated reusable owner.

Do not promote one-off presentation merely to create reuse, and do not duplicate globally owned shell or navigation behavior inside modules. Current rendering infrastructure is documented in [`../infrastructure/web-rendering.md`](../infrastructure/web-rendering.md).

## General guidance

Build the guild activity first. Let common machinery reveal itself under real use.

Prepare inexpensive semantic seams for likely future expression when justified, but do not create speculative frameworks around them.

When a module needs shared behavior, first ask which layer legitimately owns that behavior. Reuse should follow ownership; ownership should not be invented merely to create reuse.
