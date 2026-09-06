# Module Creation Guidance

Guild Operations modules should be built around **concrete guild participation or operation capabilities**, not generalized framework machinery.

A module should establish or operate a real guild activity, preserve its history, or provide authority needed to participate in it. Shared abstractions should emerge from repeated real pressure rather than being designed in advance.

## Source ownership

Concrete capability modules belong under `src/modules/<module>/` once the application has earned a module boundary for that capability.

Source ownership does not need to mirror member-facing route hierarchy. A module may appear under `/events` without being owned by Guild Events, and may contribute to shared discovery surfaces without transferring its domain truth to those surfaces.

Raffle is the current concrete example: raffle truth and procedure belong to `src/modules/raffle/`, while `/events/raffle` remains an appropriate member-facing route.

The `src/modules/` container does **not** imply a generic module loader, lifecycle, registry, or framework. Add shared module machinery only when multiple concrete modules prove that the same machinery is needed.

## Shared Guild Event contracts

When a module participates in the Events experience, distinguish among three responsibilities:

```text
Guild Event Offering
    → What participation does the guild offer?

Guild Event Calendar Listing
    → What concrete occurrence happens when?

Module destination
    → What is this activity, and how does participation work?
```

Use a **Guild Event Offering** when the activity itself should remain discoverable independently of whether an occurrence is currently scheduled. See [`guild-event-offerings.md`](guild-event-offerings.md).

Use a **Guild Event Calendar Listing** only when a concrete module-owned occurrence has temporal meaning. See [`guild-event-calendar.md`](guild-event-calendar.md).

Do not put rules, eligibility, administration, history, or module procedure into either shared projection merely because `/events` consumes them. Those meanings remain module-owned.

## Persistence

A module owns persistence for the participation or operation truth it establishes. It must not duplicate globally owned Guild Operations truth.

Modules may reference globally owned Guildies, Characters, roster observations, ranks, and other shared coordinates while persisting module-specific meaning. Referencing those objects does not transfer their ownership to the module.

Historical participation must not become a competing source of current membership, rank, or identity truth.

`Subject` is contextual language, not a global object or persistence coordinate. Persist the actual object and relationship involved.

Application-wide persistence ownership is defined in [`global-persistence.md`](global-persistence.md). Transactional member persistence boundaries are defined in [`persistence-boundary.md`](persistence-boundary.md).

## Permissioning

Modules consume globally authoritative member, roster, rank, and capability facts as inputs, while owning permission policy that belongs specifically to their procedure.

A module-specific capability may be evaluated from current global facts without becoming globally persisted permission state. Add module-specific permission machinery only when the module demonstrates a real requirement that existing global facts and capabilities cannot express directly.

Do not duplicate global authority state merely to make a local authorization decision.

The global/module permission boundary is defined in [`guild-permissioning.md`](guild-permissioning.md).

## Rendering

Rendering ownership should follow semantic ownership rather than convenience.

Use the broadest rendering owner already earned by the application:

1. **Global rendering** when presentation belongs to the shared application language.
2. **Module rendering** when reusable presentation belongs specifically to that module.
3. **Inline rendering** when the surface is genuinely exceptional and has no demonstrated reusable owner.

Do not promote one-off presentation merely to create reuse, and do not duplicate globally owned navigation or shell behavior inside modules.

Web rendering, navigation, and page-identity ownership are defined in [`web-rendering.md`](web-rendering.md).

## General guidance

Build the guild activity first. Let common machinery reveal itself under real use.

Prefer concrete module boundaries over generalized infrastructure. Prepare inexpensive semantic seams for likely future expression when justified, but do not create speculative frameworks around them.

When a module needs shared behavior, first ask which layer legitimately owns that behavior. Reuse should follow ownership; ownership should not be invented merely to create reuse.
