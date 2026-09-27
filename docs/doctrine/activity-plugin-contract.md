# Activity Plugin Contract

An **Activity** is a first-class Guild Operations occurrence whose concrete procedure is owned by an **Activity plugin**.

Activity plugins are authored in Guild Operations language. They may use Core-owned identity, authority, WoW vocabulary, rendering capabilities, Calendar, and other systemic machinery without acquiring ownership of those meanings. Core remains coherent when no Activity plugins are installed and does not depend on the procedure or existence of any concrete Activity plugin.

The governing boundary is:

> **Core machinery owns capability. Activity owns translation. Activity plugin procedure owns meaning.**

## Procedure, declaration, consequence

An Activity plugin owns the procedure through which its occurrences are established, evolve, admit or discover participation, and conclude.

Activity does not reproduce that procedure or infer its milestones from surrounding circumstances. A successful procedural operation performed by an actor with the authority required by that procedure may produce a declaration in Activity's systemic vocabulary.

```text
facts / circumstances
        ↓
plugin-defined procedure
        ↓
authorized actor completes procedure
        ↓
Activity-significant declaration
        ↓
Activity translation
        ↓
systemic consequence
```

The declaration is the boundary between plugin-owned procedural truth and Activity-owned systemic meaning.

A declaration reports the result of completed procedure. It does not ask Activity to decide whether the plugin's procedure should have succeeded.

For example, an authorized operator may establish an occurrence by completing the concrete plugin's establishment procedure: defining a new occurrence, aligning the Activity to an existing context, or satisfying whatever other criteria that Activity defines. Successful completion declares establishment. Activity does not independently infer that establishment should have occurred.

The same rule applies to conclusion, Participation adjudication, and other milestones that have Activity-wide meaning.

> **Procedure produces declarations. Activity translates declarations into systemic consequences.**

## Establishment and lifecycle

Activity lifecycle vocabulary is deliberately small:

```text
nothing
   │ successful establishment procedure
   │ declares establishment
   ▼
ACTIVE
   │ plugin-owned evolving procedure
   │ successful terminal procedure
   │ declares conclusion
   ▼
RECORD
```

**Established** and **Concluded** describe transitions produced by successful plugin procedure. **Active** and **Record** describe what the occurrence is.

Active means the occurrence remains procedurally evolvable. It does not mean that the occurrence is happening now, that participation is open, or that it must have a Calendar projection.

Record is the same Activity identity after conclusion, not a copied occurrence or a second identity.

The plugin owns the criteria and concrete meaning of establishment and conclusion. Activity owns the systemic meaning of the resulting declarations.

### Lifecycle is declaration-driven

Activity lifecycle transitions are consequences of legitimate procedural declarations. They are not inferred from clocks, schedules, projections, or surrounding circumstances.

Temporal values such as an occurrence time are **reference coordinates**. They may orient an Activity, order it, display it, or support projection into a Core capability such as Calendar. Crossing a temporal coordinate does not itself establish, advance, conclude, or otherwise change Activity lifecycle or plugin procedure.

```text
temporal coordinate
    ├─ orientation
    ├─ ordering
    └─ projection

legitimate plugin procedure
    ↓
Activity-significant declaration
    ↓
lifecycle or procedural consequence
```

Where procedure intentionally depends on time, the same authority boundary still applies. A plugin may define a cutoff or other temporal condition, and authorized machinery may observe that the condition has been satisfied, but the resulting procedural change occurs through a legitimate declaration rather than through the passage of time itself. The declaring actor may be a person or authorized automated machinery when the plugin procedure grants it that role.

> **Coordinates are facts. Declarations cause transitions.**

This distinction keeps temporal projection separate from procedural authority. Calendar may project where an Activity sits in time without becoming authoritative for what the Activity is allowed to do, and Core must not manufacture lifecycle from an Activity's temporal coordinates.

## Declarations and projections

The Activity contract has complementary write and read directions.

### Declarations

Declarations tell Activity that completed plugin procedure has produced Activity-significant truth.

Only facts with Activity-wide meaning belong at this boundary. Internal procedure remains plugin-owned. A Raid assignment, for example, remains Raid procedure unless that operation also produces a separately meaningful Activity declaration.

Declarations carry results, not instructions to reproduce procedure.

### Projections

A plugin also exposes the Activity-relevant projection of its current truth. Activity and Core consumers may use that projection without learning the plugin's private domain model or procedure.

An occurrence projection may include its Activity identity, title and description, Active or Record phase, temporal relevance, systemically representable attributes, and currently available interactions.

Declarations and projections serve different purposes:

```text
              Activity

declarations  ↑       ↓  projections
              │       │
         Activity plugin
              │
              ▼
           procedure
```

A declaration says that systemic truth changed. A projection answers what the relevant truth is now. Consumers should be able to reconcile from current projection rather than requiring permanent replay of plugin procedure.

## Shared language and authority

Core and Activity plugins deliberately share systemic vocabulary.

A plugin may understand and compose concepts such as Guildie, Character, guild Character classification, Role, Spec, rank, time, quantity, and Core capabilities into its procedure. Sharing those concepts does not transfer authority over them.

The provider of a systemic primitive owns what that primitive means and how it is resolved. The plugin owns why its procedure requires it.

For example, a plugin may declare that its procedure requires a guild Character without reimplementing the identity and roster machinery that determines whether a Character qualifies. Core resolves the classification; the plugin decides whether that classification matters.

> **Shared vocabulary does not imply shared motivation.**

> **Knowing a word is not authority to decide what the speaker means by using it.**

## Participation

Participation is an optional systemic Activity observation: a party participated in an Activity occurrence. An Activity need not produce Participation observations.

Participation is not itself procedure. A plugin owns whatever procedure gives it authority to establish that observation. One maximally expressed participation-related procedure is:

```text
Terms → Offer → Conditions → Fulfillment → Adjudication → Participation
```

This is semantic structure, not six mandatory persisted states, objects, interactions, or transitions.

- **Terms** define the standing proposition of the Activity procedure.
- **Offer** is a participant declaration accepting applicable Terms and supplying whatever choices the procedure permits.
- **Conditions** define what must be true for the relevant participation to be considered fulfilled.
- **Fulfillment** is the reality that may satisfy those Conditions.
- **Adjudication** is successful procedure declaring whether the relevant fulfillment counts.
- **Participation** is the resulting systemic observation recognized by Activity.

An Activity plugin owns this procedure and its expression. These stages are not an Activity-owned lifecycle or required ceremony. They may be explicit, richly negotiated, mechanically evaluated, human-evaluated, inherent, or absent as separately expressed artifacts when the procedure does not require them.

Participation does not require conscious enrollment or negotiation. A procedure may discover fulfillment and adjudicate Participation for an actor who made no explicit Offer, such as an achievement- or activity-scoring procedure. An explicit Offer is therefore an optional ceremonial artifact, not a universal prerequisite for Participation.

Where an explicit Offer exists, the participant remains authoritative for that Offer while it is outstanding and the procedure permits rescission. Successful adjudication into Participation settles the Offer; it becomes historical provenance rather than an outstanding declaration that can still be rescinded.

Fulfillment and adjudication remain distinct. Reality may satisfy Conditions before an authorized operator or other procedurally authorized evaluator declares that it counts. Core machinery may provide authoritative observations used by the procedure, but those observations do not autonomously advance plugin procedure.

Activity owns the resulting systemic Participation observation so consumers can use it without understanding Raid signup, Raffle claims, achievement scoring, or another plugin's procedure. Procedural references or Offers may be retained as provenance without becoming the meaning of Participation.

> **Procedure establishes why the observation is legitimate. Activity owns what the Participation observation means systemically.**

## Capability requests and representation

Activity plugins may require Core-owned capabilities as part of their procedure without acquiring ownership of those capabilities.

A plugin states what its procedure requires, permits, or has produced in Guild Operations language. Activity translates that Activity-relevant meaning into the appropriate Core capability. Core remains authoritative for how that capability works and, where applicable, how it is represented.

```text
plugin procedure
    ↓ requirement / declaration / projection
Activity
    ↓ translation
Core capability
```

This applies to identity classification, authority, administration, temporal projection, navigation, interactions, rendering, and other systemic capabilities as they are earned.

A capability request is not an instruction for Core to reproduce plugin procedure. Core may fulfill the request without becoming authoritative for why the procedure made it.

> **Procedure may request a Core capability without acquiring ownership of that capability.**

> **Core may fulfill a procedural request without acquiring authority over the procedure that caused it.**

## Core capabilities and systemic consumers

Activity translates plugin declarations and projections into Core-owned capabilities and representations.

Examples include:

- canonical Activity identity and occurrence representation;
- Calendar projection from temporal relevance;
- system-wide Participation and Participation history;
- authority and administrative declarations;
- discovery and navigation;
- Core-rendered interactions and occurrence presentation.

The plugin does not render Guild Operations. It declares what its procedure requires or permits and projects Activity-relevant truth. Activity translates those meanings into Core capabilities; Core owns their representation.

A systemic consumer must not require knowledge of a concrete Activity plugin. Calendar should not need to understand Raid or Raffle. My Participation should not need to know which plugin procedure established Participation.

> **Procedure interprets. Activity translates. The systemic consumer performs its own capability.**

## Contract obligations

An Activity plugin:

- owns its concrete procedure and procedural persistence;
- uses Core-owned vocabulary and capabilities rather than reconstructing systemic truth where an authoritative Core contract exists;
- performs its own procedural authority checks using Core authority machinery where applicable;
- produces Activity declarations when successful procedure creates Activity-significant truth;
- exposes current Activity-relevant projections without requiring consumers to understand its private domain model;
- remains authoritative for the procedural meaning behind those declarations and projections.

Activity:

- gives stable systemic meaning to recognized Activity declarations;
- translates Activity-relevant truth into Core capabilities and consumers;
- owns systemic Activity concepts such as occurrence identity, lifecycle meaning, and Participation meaning without taking ownership of concrete plugin procedure;
- does not infer, reproduce, or independently advance plugin procedure;
- insulates concrete plugins from individual systemic consumers.

Core:

- owns the shared machinery and vocabulary it provides;
- remains coherent with zero Activity plugins installed;
- does not import, require, or infer concrete Activity plugin procedure;
- fulfills Activity-translated capability requests without acquiring authority over the procedure that caused them.

The contract standardizes the **boundary of procedure**, not the expression of procedure.
