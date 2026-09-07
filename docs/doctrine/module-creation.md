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

## Administration publication

A module with its own administration surface may publish that surface into the shared administration navigation.

The publication is intentionally small:

```text
label
    → name shown in administration navigation

destination
    → module-owned landing route below /admin

permission scope
    → stable module-owned coordinate describing the authority required for the destination
```

The module also supplies the authorization evaluation for that permission scope against current Guild Operations authority. A module-specific permission does not need to become globally persisted capability state merely so the shell can decide whether to show navigation.

A module publishes its administrative presence; it does not publish its administrative interface into the global page. The module continues to own its routes, procedure, authorization enforcement, and presentation after navigation reaches its destination.

The global shell owns the administration selector. Once a module destination is registered, pages at that destination and its descendants can participate in the shared selector without reproducing selector markup or styling.

Do not register a destination merely because a module exists. Registration is appropriate only when the module has a real administrative surface. Do not add navigation metadata beyond the established administrative identity and authorization seam until actual module administration creates the need.

The current shell contract is documented in [`../infrastructure/web-rendering.md`](../infrastructure/web-rendering.md).

## Persistence

A module owns persistence for the participation or operation truth it establishes. It must not duplicate globally owned Guild Operations truth.

Application-wide persistence ownership is defined in [`global-persistence.md`](global-persistence.md). Current member reconciliation mechanics are infrastructure documented in [`../infrastructure/persistence-boundary.md`](../infrastructure/persistence-boundary.md).

## Permissioning

Modules consume globally authoritative member, roster, rank, and capability facts while owning permission policy specific to their own procedure.

Do not duplicate global authority state merely to make a local authorization decision. Current shared permission machinery is documented in [`../infrastructure/guild-permissioning.md`](../infrastructure/guild-permissioning.md).

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
