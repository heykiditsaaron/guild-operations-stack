# Event Participation Model

## Status

This document is the incumbent design model for coordinated participation in Guild Operations events.

It is design guidance, not a commitment that every noun below must become a global persistence object or shared implementation abstraction. Shared machinery should be earned through concrete activities. Raid is the current proving ground.

The current model is deliberately small:

```text
Guild Event
├── Metadata
├── Organizer demand
│   ├── Applicant eligibility
│   ├── Opportunities
│   └── Goals
├── Applications / offers
├── Assignments
├── Participation
└── Products?          activity-owned, optional
```

The central authority boundary is:

> **The organizer authors demand. The applicant authors supply. Assignment reconciles the two. Participation records reality.**

Demand may inform an applicant's offer, but it must not shape or constrain that offer. Applicant eligibility is the only organizer-authored gate on whether someone may offer supply at all.

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

## Coordination stages

Organizing coordinated participation can be understood through a few ordinary stages:

```text
organize
   ↓
apply  ────────┐
   ↓           │
assign ←───────┘
   ↓
participate
```

These words describe stages of coordination, not formal event states or required domain objects.

The organizer first establishes the event's demand. Applicants then offer supply. Assignment can begin while applications are still arriving, so application and assignment may proceed concurrently. This overlap is useful: as assignments change the visible state of the group, later applicants can understand what remains needed and decide for themselves what they are willing to offer.

Participation is downstream of this coordination. It records what actually happened after planning encounters reality.

## Organizer demand

The organizer establishes a demand sheet composed of three concerns:

```text
Demand
├── Applicant eligibility   Who may offer participation?
├── Opportunities           What group composition is desired?
└── Goals                   What properties should the assembled group achieve?
```

Demand is information authored by the organizer. It expresses what the organizer is trying to build and the criteria that will inform later assignment decisions.

Demand does not dictate applicant supply.

An eligible applicant may review the Opportunities, Goals, current offers, and current Assignments before deciding what to offer. That visibility can influence human intent without becoming a software constraint.

For example, a Guildie who prefers damage may see that the raid still lacks a tank and voluntarily offer a tank configuration instead. The same Guildie remains free to offer damage anyway.

> **Demand informs supply. It does not shape supply.**

### Applicant eligibility

Applicant eligibility answers exactly one question:

> **Who is allowed to submit an offer?**

It is a meta-level access boundary over application. It does not describe what the group needs, whether an offer fits an Opportunity, whether an offer advances a Goal, or whether the organizer is likely to assign it.

Once an applicant passes this gate, the content of their offer belongs to them.

Organizer-selected eligibility may eventually distinguish boundaries such as Guild-character-backed participation, Guildies, or Anyone, but the exact organizer-facing palette should be established through implementation pressure rather than a speculative rules engine.

The important invariant is already established:

> **Applicant eligibility is the only organizer-authored gate that controls whether supply may be offered. After that gate, the applicant is responsible for what they submit.**

### Opportunities

Opportunities express the desired group composition.

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

An Opportunity is therefore part of organizer demand. It is not an application target and it is not consumed merely because someone offers a compatible playable configuration.

> **Applicants do not apply to Opportunities. They submit offers. Assignment is the only operation that places an offer into the desired composition.**

Opportunity quantity may be bounded or unlimited where the activity permits it. Capacity follows from the organizer's expressed composition rather than being authored as a second independent fact.

In WoW combat composition, Blizzard's familiar role geometry gives us useful fundamental shapes such as `tank`, `healer`, and `damage`. More specific concerns such as ranged, melee, lust, or battle resurrection generally describe properties of the assembled group and belong more naturally as Goals unless a concrete activity proves otherwise.

A `general` Opportunity remains useful for participation that does not need a more specific composition shape.

Opportunities are visible information. Their purpose during application is to let an applicant understand the organizer's demand, not to restrict which offers the application surface permits.

### Goals

Goals express desired aggregate properties of the assembled group.

Examples for a raid or Mythic+ group might include:

```text
lust >= 1
battle_res >= 1
ranged >= 6
```

Nothing is assigned to a Goal. Goals are evaluated over the current Assignments and the properties those assigned offers bring.

Goals are also visible information during application. An applicant may notice that the group lacks lust and choose to offer a configuration capable of providing it. They remain free to offer something else.

The system may calculate and expose Goal consequences during assignment without deciding which applicant the organizer should choose.

> **Guild Operations should calculate composition consequences; the organizer retains composition judgment.**

Goals are optional. Activities that gain nothing from aggregate composition evaluation should not inherit raid-level complexity.

### Presets

Presets are authoring shortcuts over organizer demand.

A preset may populate Opportunities and Goals together:

```text
Raid preset
├── Opportunities
│   ├── tank × 2
│   ├── healer × 4
│   └── damage × 14
└── Goals
    ├── lust >= 1
    └── battle_res >= 1
```

A Mythic+ preset may establish a different common demand sheet. The organizer may then alter it.

Presets do not define event kinds, applicant supply, assignment policy, or participation. They simply provide useful starting demand.

## Applications and supply

An Application is an applicant-authored offer of participation.

> **Applications are presented, not shaped.**

Once an applicant passes applicant eligibility, Guild Operations should allow them to state what they are willing to bring. The organizer's Opportunities and Goals may be displayed as context, but must not filter, disable, steer, or otherwise constrain the applicant's available offers.

This is a deliberate authority boundary:

```text
Organizer authors demand.
Applicant authors supply.
Assignment reconciles them.
```

An offer may be internally validated for coherence. For example, a declared specialization should actually belong to the declared class. That validates the truthfulness or structural coherence of the offer itself; it is not validation against organizer demand.

### Playable offers

Raid has exposed two useful ways to present a playable offer.

A Character-backed offer may select a Character already known to Guild Operations:

```text
Character-backed offer
└── Character
    ├── class            derived
    ├── specialization   derived from the Character-backed selection/state
    ├── role             derived
    └── traits           derived
```

A declared offer may state the playable configuration directly:

```text
Declared offer
├── class
├── specialization
├── role                 derived
└── traits               derived
```

The exact Character-backed specialization behavior should follow the authoritative Character/spec facts available at implementation time rather than assuming current active specialization is the only playable specialization.

The two paths allow the same downstream gameplay geometry while preserving different evidence. A known Character can anchor an offer to Blizzard-observed Character facts. A declaration records what the applicant says they are willing to bring without pretending Guild Operations has Character authority it does not possess.

Which offer forms are permitted or required may follow from the organizer's applicant-eligibility choice. This does not change the Application model: it changes whether the applicant is allowed to offer under the event's access boundary.

A known Guildie should not be forced to lose known identity merely because an event permits broader participation. If Guild Operations knows the applicant, it should project that relationship; if it does not, it should not manufacture one.

### Multiple offers

An applicant may submit multiple Applications when they genuinely offer multiple ways to participate.

For example:

```text
Offer A
└── Protection Paladin

Offer B
└── Fire Mage
```

Neither offer claims a tank or damage Opportunity. They simply communicate the applicant's available supply.

Applications therefore form the available supply naturally. There is no need for a separate applicant-pool or remainder-pool entity.

An unassigned offer has no inherent social or operational meaning beyond being unassigned. Guild Operations must not silently promote it to `backup`, `bench`, `alternate`, or another organizer judgment.

Historical offers should not be deleted merely because another offer from the same applicant receives an Assignment. The fact that the applicant offered another configuration remains meaningful history.

## WoW-authored geometry and traits

Blizzard remains authoritative for Blizzard-owned Character facts. Guild Operations should preserve useful gameplay geometry from authoritative facts and deterministic mappings rather than ask organizers to recreate it manually.

For combat participation, an offer can expose derived properties such as:

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

The precise trait vocabulary and source mappings should be established through Raid implementation rather than prematurely generalized or guessed.

The authority boundaries are:

- Blizzard-observed Character facts remain Blizzard-authored facts;
- deterministic class/spec/role/trait geometry must come from a trustworthy source;
- the applicant authors which playable configuration they offer;
- the organizer authors demand and later assignment judgment.

Authoritative or derived gameplay traits must not be confused with organizer-authored annotations. `ranged` and `lust` describe the offered piece. `backup` and `priority`, if later useful, describe how an organizer regards an offer.

## Assignment

Assignment is where organizer demand and applicant supply meet.

> **Assignment places an offered playable configuration into the composition expressed by organizer demand.**

Before Assignment, an Application has not claimed, reserved, targeted, or filled an Opportunity.

Conceptually:

```text
Demand                         Supply

Tank × 2                       Protection Paladin
Healer × 4                     Holy Priest
Damage × 14                    Fire Mage
Goals                          Fury Warrior

              \               /
               \             /
                Assignment
                    ↓
              assembled group
```

Assignment is the organizer's meaningful placement decision. It answers questions that intentionally do not belong to applicant eligibility or Application submission:

- Does this offer fit this portion of the desired composition?
- Is capacity still available?
- What Goals would this Assignment satisfy or advance?
- Does the organizer actually want to make this placement?

The system can calculate fit and consequences. The organizer retains the judgment.

A useful distinction is:

```text
Applicant eligibility
→ Can this person offer?

Offer coherence
→ Is this a structurally truthful playable declaration?

Assignment fit
→ Can this offer occupy this part of the composition?

Goal contribution
→ What does this Assignment do to the assembled whole?
```

Only the first question is applicant eligibility.

### Concurrent application and assignment

Applications do not need to close before Assignment begins.

This overlap creates a useful coordination feedback loop:

```text
Demand published
      ↓
Offers arrive ←──────────────┐
      ↓                      │
Assignments happen          │
      ↓                      │
Visible group state changes  │
      ↓                      │
Applicants see it ───────────┘
```

Applicants can choose to inspect the organizer's demand and the current state of reconciliation before making or changing their own offers. This allows organizers and applicants to develop a shared understanding without requiring direct conversation for every adjustment.

The software should make the coordination state legible; it should not turn that legibility into coercion.

### Automatic assignment

Automatic assignment, if an activity eventually needs it, is an assignment policy rather than an application rule or event type.

It must operate over the same independent facts: organizer demand and applicant-authored supply. It must not reshape what an eligible applicant is permitted to offer.

Manual assignment should remain the clearest proving ground for Raid because it exposes the actual reconciliation semantics before automation is added.

## Composition and Goal coverage

Assignments allow Guild Operations to project the current assembled group against organizer demand.

For a raid, the shared picture may include desired, offered, and assigned supply:

```text
                 DESIRED    ASSIGNED    OFFERED
Tank                2           1           1
Healer              4           4           6
Damage             14          12          18

GOALS
Lust                           met
Battle Res                     unmet
Ranged                         5 / 6
```

The exact presentation can evolve, but the information relationship matters. Applicants can understand demand and existing supply; organizers can understand available supply and current reconciliation.

Assignment can additionally expose consequences before a placement is made:

```text
Fire Mage
[damage] [ranged] [lust]

If assigned:
- Damage 12 / 14 → 13 / 14
- Lust 0 / 1 → 1 / 1
- Ranged 5 / 6 → 6 / 6
```

This removes calculation burden without manufacturing a roster recommendation.

## Participation

Participation means participating.

Assignment records the planned composition. Participation records what actually happened.

Someone may be eligible without offering, offer without being assigned, be assigned and fail to appear, or participate after a legitimate real-world substitution. Those distinctions should remain representable rather than being collapsed into a single participant status.

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

A Guildie remains the durable actor even when a particular Character is meaningful to an offer. Class, role, and specialization shape offered participation but do not become identity.

Useful boundaries include:

- Guildie participation may project the selected main when no event-specific Character is meaningful;
- Character-backed offers should present the Character actually being offered rather than silently substituting the selected main;
- broader applicant eligibility should still project a known Guildie relationship when one exists;
- an unknown applicant may use event-local identity without Guild Operations pretending that person is a Guildie.

Organizers configure who may offer participation. Representation is derived from known identity, Application context, and surface rather than independently selected by the organizer.

## Pressure tests

### Progression raid

The organizer establishes demand:

```text
Applicant eligibility
└── Guildies

Opportunities
├── tank × 2
├── healer × 4
└── damage × 14

Goals
├── lust >= 1
├── battle_res >= 1
└── ranged >= 6
```

Applicants who pass eligibility may offer whatever playable configurations they choose. A Guildie may offer a Protection Paladin, a Fire Mage, both, or neither. The application surface does not require them to select a tank or damage Opportunity.

The demand sheet is visible, so applicants can understand what the organizer is trying to build. A damage-preferring Guildie may voluntarily offer a tank after seeing that tank demand remains unmet, but Guild Operations does not force that choice.

The organizer assigns offers into the desired composition. Each potential Assignment can expose role fit and Goal consequences without choosing on the organizer's behalf.

Applications and Assignments may continue concurrently until the organizer is satisfied with the assembled group.

Assignment does not establish actual raid attendance; Participation does.

### Mythic+ group

An organizer who already accounts for part of the real group may express only the demand Guild Operations needs to coordinate:

```text
Opportunities
├── tank × 1
├── healer × 1
└── damage × 1

Goals
├── lust >= 1
└── battle_res >= 1
```

Applicants still offer independently of those Opportunities. The organizer reconciles the available supply against the remaining demand through Assignment.

The demand sheet does not need to reconstruct all five in-game positions when some participation is already accounted for elsewhere.

### Fashion show

A fashion show may have very simple demand:

```text
Opportunities
└── general × 10

Goals
└── none
```

Applicant eligibility controls who may submit an entry offer. The activity can define what an offer contains without inheriting Raid's class/spec geometry. Assignment can establish which offers make up the show. Judging or awards may later be activity-owned Products.

### Housing competition

A housing competition may use:

```text
Opportunities
└── general × unlimited

Goals
└── none
```

The simple activity does not inherit Raid's composition complexity merely because the same demand/supply relationship can describe its coordination.

### Raffle and Hidden in Plain Sight

Existing self-contained activity modules should not be mechanically translated into this coordination vocabulary merely because conceptual parallels can be found.

Raffle already owns meaningful concepts such as claims, tickets, draws, winner, and winnings. Hidden in Plain Sight owns game-mode-specific participation and resolution. Their Guild Event conformance comes from the shared metadata contract, not from being forced through Raid-shaped coordination machinery.

The coordination model exists for activities that genuinely need coordinated participation. It is not a requirement that every Guild Event implement demand, Applications, Assignments, or Goals.

## Working model

The demand/supply analogy is useful because it preserves authorship:

```text
ORGANIZER                         APPLICANT

Demand                            Supply
├── applicant eligibility         └── offers
├── opportunities
└── goals

          \                       /
           \                     /
            └─── Assignment ────┘
                      ↓
                assembled group
                      ↓
                Participation
```

The organizer publishes what they are trying to build. Applicants present what they are willing to bring. Everyone can inspect enough of the shared state to make informed human decisions without requiring direct conversation for every adjustment.

The final governing principles are:

> **Applicant eligibility controls who may offer.**

> **Demand informs supply; it does not shape supply.**

> **Applications present offers; they do not claim Opportunities.**

> **The applicant owns the content of the offer.**

> **Assignment is the only place demand and supply are reconciled.**

> **Guild Operations exposes fit and consequences; humans retain judgment.**

> **Participation records reality after coordination has done its work.**

## What this model intentionally does not establish

This model does not establish:

- a universal Guild Event persistence table;
- a generic applicant or guest identity framework;
- a generic eligibility rules engine;
- a generic arbitrary constraint solver;
- a recommendation or roster-optimization engine;
- a universal organizer-tagging system;
- a universal Product schema;
- a generic event lifecycle state machine;
- a generic notification or message bus;
- a requirement that all Guild Events use this coordination machinery.

Those abstractions should be introduced only when multiple concrete activities prove they are necessary.

Raid should now pressure-test this model through implementation.