# Event Participation Model

## Status

This document is the incumbent design model for coordinated participation in Guild Operations events.

It replaces the earlier `Opportunity → Operation → Participation → Result` discovery model. That earlier model was useful for finding the domain, but subsequent pressure testing through raids, Mythic+ groups, fashion shows, housing competitions, and existing activity modules produced a smaller and more concrete vocabulary.

This is design guidance, not a commitment that every noun below must become a global persistence object or shared implementation abstraction. Shared machinery should still be earned through concrete activities. Raid is the current proving ground.

The intended coordination model is:

```text
Guild Event
├── Metadata
├── Composition
│   ├── Opportunities
│   └── Goals
├── Applications
├── Assignments
├── Participation
└── Products?          activity-owned, optional
```

The central distinctions are:

> **Opportunities describe the places available for participation. Goals describe desired properties of the assembled whole. Applications offer participation. Eligibility determines fit. Assignments establish the organizer's placement decision. Participation records what actually happened.**

## Mechanical Guild Event boundary

The coordination model does not define what mechanically constitutes a Guild Event. Event-ness has a smaller contract.

> **A Guild Event is defined mechanically by conformance to its required metadata contract, not by declaration or operational behavior.**

At minimum, a Guild Event establishes:

- `occurs_at_unix` — the authoritative temporal coordinate occupied by the event, represented as an instant or range according to the established Unix-time contract;
- `label` — the human-recognizable label for what occupies that temporal slot.

A module does not make an object a Guild Event merely by calling it one or by implementing participation machinery. This deliberately defines event-ness without requiring every event to operate participation in the same way.

## Standardized event metadata enrichment

Once an object satisfies the required Guild Event metadata contract, it may use standardized optional vocabulary such as:

- `description` — additional human-readable understanding of the event;
- `tags` — standardized classification or interpretation metadata;
- `interactions` — standardized metadata describing available approaches to module-owned operation.

The governing rule is:

> **Guild Event metadata standardizes vocabulary, not completeness. Production is optional. Consumption is optional. Conformance is required when shared vocabulary is used.**

`interactions` is the seam through which module-owned operation may become available to generic consumers. It does not relocate operational authority into Guild Event machinery. The exact interaction shape remains intentionally uncommitted until implementation pressure earns it.

## Metadata ownership and authority

The emanating activity or module owns its Guild Event metadata as part of its authoritative state. Its own presentation and generic consumers should consult those same facts rather than maintain peer copies.

A raid's authoritative `label`, for example, should be the label used by the raid surface and by future Calendar, Discord, notification, or other consumers. Consumers may present that fact differently, but they should not become independent owners of it.

> **A consumer should not own a second authoritative version of an event-description fact merely because it needs that fact to render.**

Guild Operations defines the shared language by which an activity can be understood as a Guild Event. The emanating activity defines how that event operates and what participation means.

## Composition

Composition is the organizer-authored shape of coordinated participation.

It contains two complementary kinds of information:

```text
Composition
├── Opportunities   What positions need filling?
└── Goals           What should the assembled composition achieve?
```

This distinction is fundamental:

> **Opportunities constrain individual assignment. Goals evaluate aggregate assignment.**

An activity may use Opportunities without Goals. A housing competition may simply expose unlimited general participation. A raid may use both because assembling a useful roster requires more than counting occupied positions.

Composition describes what Guild Operations is coordinating. It does not need to reconstruct every real-world participant or position already accounted for outside the application. If a Mythic+ organizer already has two confirmed players, the Composition may describe only the remaining places being offered.

### Opportunities

An Opportunity is the unit of Composition.

> **An Opportunity is an assignable place available for participation.**

Examples include:

```text
general × unlimited

tank × 1
healer × 1
damage × 3

tank × 2
healer × 4
damage × 14
```

Opportunity quantity may be bounded or unlimited where the activity permits it. Capacity is therefore derived from the Opportunities rather than authored as a second independent fact.

Opportunities should remain as structurally simple as the activity permits. In WoW combat composition, Blizzard's familiar role geometry gives us the useful fundamental shapes `tank`, `healer`, and `damage`. More specific composition concerns such as ranged, melee, physical, magical, lust, or battle resurrection should not automatically become new Opportunity types merely because an organizer cares about them.

A `general` Opportunity remains useful for participation that does not need a more specific shape.

Presets may populate a useful set of Opportunities, but are authoring shortcuts rather than event kinds. A Mythic+ preset can produce one tank, one healer, and three damage Opportunities without making `Mythic+ preset` a fundamental persisted event category.

### Goals

A Goal describes a desired aggregate property of the assembled Composition.

Examples for a raid or Mythic+ group might include:

```text
lust >= 1
battle_res >= 1
ranged >= 6
```

Nothing is assigned to a Goal. Goals are evaluated over the currently assigned Applications and the authoritative or derived properties those Applications bring.

This prevents an organizer's roster objective from becoming a false statement about individual eligibility. A Shadow Priest can be fully eligible for a Damage Opportunity even when the current roster still needs lust. A Fire Mage may also be eligible for that same Opportunity while additionally satisfying the outstanding lust Goal.

The system can therefore expose consequences such as:

```text
Fire Mage
[damage] [ranged] [lust]
Would satisfy: Lust

Shadow Priest
[damage] [ranged]
No currently unmet Goal satisfied
```

without deciding which applicant the organizer should choose.

The governing authority rule is:

> **Guild Operations should calculate composition consequences; the organizer retains composition judgment.**

Goals are optional. Activities that gain nothing from aggregate composition evaluation should not inherit raid-level complexity.

## Applications

An Application is an applicant-authored offer to fill an Opportunity.

For a raid, an Application may contain:

```text
Application
├── target opportunity shape: damage
├── character: Mage
└── specialization: Fire
```

Another activity may require less. A fashion show may require a Character but no specialization. A general guild activity may require neither. The application shape belongs to the activity and should not become a speculative generic dynamic-form framework.

A single applicant may submit multiple Applications when they are genuinely offering multiple ways to participate. For example, a Guildie might offer a Mistweaver Monk for Healer and a Fire Mage for Damage. Those are two distinct offers, not one ambiguous list of possible roles.

### Applications are the pool

There is no separate applicant-pool entity.

> **Applications are the pool.**

The actionable remainder is derived from Applications that remain valid and are not currently consumed by a mutually exclusive Assignment.

An unassigned Application has no inherent social or operational meaning beyond being unassigned. Guild Operations must not silently promote it to `backup`, `bench`, `alternate`, or another organizer judgment.

If an organizer wants to classify an Application as backup, priority, contacted, or similar, that meaning belongs to the organizer and may eventually be expressed as organizer-authored annotation or tagging over the Application.

> **The unassigned pool has no inherent meaning beyond being unassigned. Further classification belongs to whoever has authority to make that classification.**

Historical Applications should not be deleted merely because another Application from the same applicant receives an Assignment. The historical fact that the applicant offered another shape remains useful. The competing Application may simply cease to be actionable while the mutually exclusive Assignment exists.

If that Assignment is released, still-valid Applications may become actionable again according to the activity's rules.

## Eligibility

Eligibility is not merely a broad gate describing who may apply.

> **Eligibility is whether an Application satisfies the criteria necessary to align with an Opportunity.**

Conceptually:

```text
Opportunity ───────┐
                   ├── Eligibility
Application ───────┘
```

Eligibility may incorporate several kinds of facts where relevant:

- the allowed applicant boundary, such as Anyone, Guildie, or Guild character;
- controlled Character relationship;
- current guild membership when required;
- Character and specialization facts;
- WoW role derived from specialization;
- Opportunity-specific criteria.

The applicant authors intent. Eligibility validates alignment.

For example, if a Fire Mage Application targets a Damage Opportunity, Blizzard-authored specialization geometry establishes that the offered Character/spec can legitimately fill that role. Guild Operations should use that authoritative geometry rather than create a parallel manual truth.

Eligibility does not decide whether the organizer wants that applicant in the final composition. That decision belongs to Assignment.

## WoW-authored geometry and traits

Blizzard remains authoritative for Blizzard-owned Character and specialization facts. Guild Operations should preserve useful geometry from those facts rather than ask organizers or applicants to restate it manually.

For combat participation, an Application can expose derived properties such as:

```text
Fire Mage
├── role: damage
└── traits
    ├── ranged
    ├── magical
    └── lust
```

or:

```text
Fury Warrior
├── role: damage
└── traits
    ├── melee
    └── physical
```

The precise trait vocabulary and source mappings should be established through Raid implementation rather than prematurely generalized. The important boundary is already clear:

- Blizzard-authored facts and deterministic derivations describe what the offered Character/spec is capable of;
- the applicant authors which Character/spec they are offering;
- the organizer authors composition Goals and operational judgments.

Authoritative or derived traits must not be confused with organizer-authored tags. `ranged` and `lust` describe the offered piece. `backup` and `priority` describe how an organizer regards an Application.

> **Preserve authoritative geometry; constrain only the dimensions the activity actually cares about.**

## Assignments

An Assignment binds an eligible Application to an Opportunity.

```text
Application ── Assignment ──► Opportunity
```

Assignment is the organizer's meaningful placement decision. A separate generic Approval layer is not required merely to say that an Application has been accepted: for coordinated composition, Assignment establishes the acceptance that matters.

Authorship must remain visible. The applicant authors the Application. The organizer authors the Assignment, unless an organizer-established policy performs that procedure automatically.

### Automatic assignment

Automatic assignment is an assignment policy, not an event type.

Conceptually:

```text
Application submitted
→ Eligibility passes
→ compatible open Opportunity exists
→ Assignment created
```

Manual assignment uses the same domain facts:

```text
Application submitted
→ Eligibility passes
→ Application remains in pool
→ organizer assigns
```

Automatic procedure does not manufacture authority. It executes policy established by the organizer or activity.

First-come-first-served behavior can naturally emerge from automatic assignment against remaining open Opportunities without requiring a separate event mode.

### Multiple Applications and mutual exclusivity

An applicant may have multiple eligible Applications, but an Assignment may consume that applicant's availability for mutually exclusive Opportunities.

For Raid, assigning a Guildie's Healer Application should make that Guildie's competing Damage Application non-actionable while the Assignment exists. The competing Application remains historical rather than being deleted.

This should not be elevated into a universal one-assignment-per-person rule for every future activity. Mutual exclusivity belongs to the activity where the constraint is real.

## Composition coverage

Assignments give Guild Operations enough information to project the current assembled Composition.

For a raid, the organizer can be shown both structural filling and Goal coverage:

```text
OPPORTUNITIES
✓ Tanks       2 / 2
✓ Healers     4 / 4
○ Damage     12 / 14

GOALS
✓ Lust        1 / 1
✓ Battle Res  1 / 1
○ Ranged      5 / 6
```

This projection should update as Assignments are created, changed, or released.

The same information can help at the point of decision. An Application can show which unmet Goals would become satisfied if assigned, without ranking applicants or making the selection on behalf of the organizer.

This is an important Guild Operations value proposition: remove calculation burden without manufacturing human judgment.

## Participation

Participation means participating.

Assignment records planned or accepted placement. Participation records what actually happened.

Someone may be eligible without applying, apply without being assigned, be assigned and fail to appear, or participate after a legitimate real-world substitution. Those distinctions should remain representable rather than being collapsed into a single participant status.

The threshold that establishes actual Participation belongs to the activity. Raid attendance, a fashion-show presentation, a housing entry, and asynchronous game participation may establish reality differently.

Presence and participation are not synonymous.

Historical Participation should remain meaningful even when current eligibility later changes. Current authority can govern what someone may do now without rewriting what actually happened.

## Products

A Product is an optional activity-owned output of an event.

Events are not required to produce one, and no universal Product schema has been earned.

Examples include:

- raffle winner and winnings;
- fashion-show placements or awards;
- housing-competition placements or awards;
- Hidden in Plain Sight mode-specific resolution.

A Raid does not need a Product merely because another activity has one.

Products therefore sit outside the base coordination chain and remain the prerogative of the activity.

## Identity and representation

Application context does not replace durable identity.

A Guildie remains the durable actor even when a particular Character is meaningful to an Application. Role and specialization shape the offered participation but do not become identity.

Useful boundaries include:

- Guildie participation may project the selected main when no event-specific Character is meaningful;
- Character-specific Applications should present the Character actually being offered rather than silently substituting the selected main;
- Guild-character eligibility constrains the offered Character to the currently controlled/current-roster intersection;
- Anyone eligibility may project a known Guildie relationship when one exists while allowing event-local identity when it does not.

Organizers configure participation rules. Representation is derived from identity, Application context, and surface rather than selected independently by the organizer.

## Pressure tests

### Progression raid

```text
Composition
├── Opportunities
│   ├── tank × 2
│   ├── healer × 4
│   └── damage × 14
└── Goals
    ├── lust >= 1
    ├── battle_res >= 1
    └── ranged >= 6
```

Applicants may offer multiple Character/spec Applications. Eligibility validates each offer against its target role. Blizzard-derived traits make the effect of each potential Assignment legible. The organizer assigns a deliberate roster while Guild Operations continuously projects filled Opportunities and Goal coverage.

Unassigned Applications remain the remainder pool. They are not automatically backups. The organizer may eventually annotate them when useful.

Assignment does not establish actual raid attendance; Participation does.

### Mythic+ group

An organizer who already accounts for part of the real group may expose only the places Guild Operations needs to coordinate:

```text
Composition
├── Opportunities
│   ├── tank × 1
│   ├── healer × 1
│   └── damage × 1
└── Goals
    ├── lust >= 1
    └── battle_res >= 1
```

The Composition does not need to reconstruct all five in-game positions. Goals evaluate the assembled group properties while Opportunities describe the open coordinated places.

### Fashion show

```text
Composition
├── Opportunities
│   └── general × 10
└── Goals
    └── none
```

An Application may require a Character but no specialization. Automatic assignment can fill the bounded general Opportunities. Additional Applications simply remain unassigned unless an Opportunity becomes available. Judging or awards may later be activity-owned Products.

### Housing competition

```text
Composition
├── Opportunities
│   └── general × unlimited
└── Goals
    └── none
```

Eligible Applications can be automatically assigned immediately. Participation and eventual judging remain activity-specific. The simple activity does not inherit Raid's composition complexity merely because the same coordination vocabulary can describe both.

### Raffle and Hidden in Plain Sight

Existing self-contained activity modules should not be mechanically translated into this coordination vocabulary merely because conceptual parallels can be found.

Raffle already owns meaningful concepts such as claims, tickets, draws, winner, and winnings. Hidden in Plain Sight owns game-mode-specific participation and resolution. Their Guild Event conformance comes from the shared metadata contract, not from being forced through Raid-shaped coordination machinery.

This is an important boundary: the coordination model exists to support activities that genuinely need coordinated participation. It is not a requirement that every Guild Event implement Applications, Assignments, Opportunities, or Goals.

## Geometry model

The geometric analogy remains useful, but its pieces are now concrete:

> **Composition defines the shape. Opportunities are the individual holes. Applications offer pieces. Eligibility determines whether a piece fits a hole. Assignment places the piece. Goals evaluate the assembled shape. Participation records what was actually realized.**

WoW and Blizzard may already author important dimensions of the pieces. Guild Operations should preserve that geometry and let the activity constrain only what it actually cares about.

The goal is not to remove meaningful constraints. It is to eliminate the work caused by poorly expressing and operating those constraints.

## Implementation guidance

This model should now guide Raid implementation and be refined only when concrete implementation or another real activity exposes a contradiction.

Several implementation details remain deliberately open:

- whether an Application targets an Opportunity class/shape or a specific bounded Opportunity instance before Assignment;
- the exact persistence and API representation of Eligibility;
- the exact source and vocabulary of WoW-derived traits;
- the representation of organizer-authored Application annotations;
- the evidence that realizes Raid Participation;
- which coordination concepts prove reusable enough to live in shared Guild Event machinery rather than Raid-owned implementation.

These are implementation questions, not reasons to reopen the conceptual model prematurely.

Do not introduce a generic rules engine, roster solver, event-sourcing framework, notification bus, guest-identity framework, universal Product schema, or other generalized machinery merely because this model creates a place where one could be imagined.

Build Raid against the model. Let shared machinery reveal itself under pressure.
