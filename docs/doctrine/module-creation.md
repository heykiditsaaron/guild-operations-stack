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

**REST resource paths and web presentation paths are independent adapter concerns.** REST should expose authoritative application subjects using conventional machine-oriented resource paths. Web routes should place the same subjects where humans naturally participate in or operate the guild activity. Neither route hierarchy is derived from, or authoritative for, the other.

For example, a Raffle may be exposed to machines as `/api/v1/raffles/:raffleId` while its human presentation remains under `/events/raffle/:raffleId`. Both address the same application subject through the same application contract; the difference belongs to the medium.

Raid and Raffle are the first paired reference implementations of this shape. Their concrete contracts are documented in [`../features/raid.md`](../features/raid.md) and [`../raffle.md`](../raffle.md). Treat their common boundaries as proven vocabulary to pressure-test against and their differences as evidence of module ownership, not as a generic event superclass or workflow that later modules must imitate.

## Guild Activity governance

A **Guild Activity** is a guild-owned, lifecycle-bound temporal occurrence. Raid and Raffle are the first concrete Guild Activity modules.

Internally, **activity** names the authoritative lifecycle-bound subject. **Event** names a meaningful system occurrence concerning authoritative state. Human-facing adapters may still present Guild Activities as **Events** where that is the natural member vocabulary; presentation language does not redefine the underlying domain concept.

Guild Activity lifecycle vocabulary is deliberately small:

```text
nothing
   │
   │ establish
   ▼
 active
   │
   │ domain-defined conclusion
   ▼
concluded
```

**Establishment is an operation/event, not a lifecycle state.** Establishment brings a previously nonexistent Guild Activity into the active state. **Active** means the activity's activation continues. **Concluded** means that activation has ended.

Conclusion is semantic rather than a required persisted transition. A domain may derive conclusion from time, preserve explicit conclusion facts, or use another legitimate domain rule. Cancellation, completion, drawing, expiration, or other terminal meanings are domain-defined ways an activity may conclude; they are not additional universal Guild Activity lifecycle states. The domain also owns whether and how a concluded activity survives as durable history.

A Guild Activity may expose participation, but participation is not what makes it a Guild Activity. Guild Activities without signup, registration, entry, or other participation machinery remain legitimate temporal activities.

When an active Guild Activity does expose participation, its participation availability may be described as:

- **open** — new participation may currently be established;
- **closed** — new participation may not currently be established.

Open and closed are participation adjectives of an active activity, not peer lifecycle states. Closed participation does not conclude the activity and may be reversible when the domain permits it. Once the activity is concluded, current participation availability no longer applies.

These terms standardize semantic governance, not implementation. A Guild Activity domain continues to own:

- establishment and modification procedure;
- authoritative temporal facts and their domain representation;
- the rules that determine whether it is active or concluded;
- any participation procedure and open/closed rules;
- conclusion kinds and consequences;
- persistence and historical evidence;
- application operations and authority.

Do not introduce a generic Guild Activity table, superclass, lifecycle engine, registry, shared status column, or mandatory application interface merely to encode this vocabulary. Shared machinery should still be earned by concrete pressure from multiple domains.

### Semantic events and emissions

A domain owns which meaningful system events are significant enough to publish as semantic emissions. Guild Activity governance does not require establishment, modification, conclusion, cancellation, participation changes, or any other occurrence to be emitted.

When a domain does publish an event, it follows the application-wide semantic emission code shape. For example, a domain may choose to publish an establishment event as `raid.established` or `raffle.established`. Standardizing the shape of emission codes does not standardize which emissions must exist.

Consumers independently decide which published events matter to them. Calendar, for example, may consume a domain's establishment emission in order to establish or reconcile its own temporal point. That consumer relationship does not transfer lifecycle authority to Calendar, and Calendar does not require a Guild Activity to publish any particular event merely because the activity is temporal.

## Shared projections

A module may express selected facts through shared infrastructure when that infrastructure has a legitimate cross-module consumer. The module remains authoritative for its own lifecycle, participation, operation, and history.

### Calendar as a temporal map

Calendar owns a deliberately small temporal map. Its persisted point answers only:

- **when does this authoritative subject occur?**
- **which authority and subject should a consumer query when it wants to project that point?**

A Calendar point therefore consists of a source/subject reference plus its temporal coordinate or range. Calendar persistence does not own copied titles, lifecycle labels, participation state, destinations, winners, descriptions, or other module facts merely because a Calendar presentation might display them.

The owning module's application query remains authoritative for projection guidance. That query may expose recognition metadata, category/designation, public inspection destinations, participation destinations, operational destinations, or other values that mean: **if a consumer chooses to project this aspect, this is the authoritative value to use.** Providing that guidance does not prescribe which values a Calendar presentation must show or how it must show them.

This keeps Calendar presentation open-ended. The same persisted temporal point may support an agenda, grid, history view, compact widget, Discord expression, or another surface without changing Calendar truth.

Calendar receives semantic emissions only for occurrences it explicitly cares about. Current Calendar interests are top-level activity subjects such as Raid and Raffle establishment, modification, conclusion where relevant, and cancellation. Subordinate parent/subject emissions such as Raid signups or Raffle claims do not currently establish or move Calendar points and are therefore not Calendar concerns. This is an earned current boundary, not a rule that Calendar can never care about a subordinate subject.

For current lifecycle handling:

- establishment establishes/reconciles the temporal point;
- modification re-queries the authoritative subject and reconciles the point;
- Raffle conclusion may re-query/reconcile but does not withdraw the point;
- cancellation withdraws the point;
- time passing alone does not withdraw a point.

Calendar retention and eventual cleanup are Calendar-owned housekeeping, not source-domain lifecycle. Raid post-occurrence conclusion/history semantics remain intentionally unresolved until Raid earns that ceremony.

Legacy event-publication shapes are not doctrine for this machinery. Modules emit semantic occurrences; Calendar decides which occurrences matter, queries the authoritative module contract, and maintains its own temporal map.

Do not put rules, eligibility, administration, history, or module procedure into Calendar persistence merely because a Calendar interface could display them.

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
