# Activity Plugin Contract

An **Activity** is a first-class Guild Operations occurrence whose concrete procedure is owned by an **Activity plugin**.

Activity plugins are authored in Guild Operations language. They may use Core-owned identity, authority, WoW vocabulary, rendering capabilities, Calendar, and other systemic machinery without acquiring ownership of those meanings. Core remains coherent when no Activity plugins are installed and does not depend on the procedure or existence of any concrete Activity plugin.

The governing boundary is:

> **Core machinery owns capability. Activity owns translation. Activity plugin procedure owns meaning.**

## The Activity framework

Activity is a Guild Operations framework, not a single abstraction or a general-purpose plugin framework. Its purpose is to let concrete Activity plugins express and operate their procedure as first-class Guild Operations activities while keeping semantic authority explicit.

The framework may provide different mechanisms for different kinds of communication across the Core/plugin boundary. Those mechanisms may include ordinary typed application APIs, Core-owned resources, shared semantic vocabulary, declarations, projections, capability requests, interactions, semantic presentation shapes, or purpose-built seams earned by a concrete procedure. They do not need artificial uniformity merely because they cross the same boundary.

Use the mechanism that fits the meaning being communicated. An ordinary resource or operation does not become more correct by being disguised as Activity-specific machinery. Likewise, a plugin-specific procedural concept does not need to be generalized before Guild Operations may support its legitimate expression.

> **Use shared machinery where meaning is shared. Permit bespoke expression where meaning is bespoke. Keep authority explicit in both cases.**

The framework is intentionally specific to Guild Operations and its Activity plugins. It may therefore understand Guild Operations and World of Warcraft concepts deeply where doing so serves the product. It does not need to satisfy the abstractions of an imagined general plugin ecosystem.

Concrete pressure earns framework capability. Reuse and multiple consumers are strong evidence for generalization, but uniqueness is not evidence against support. A capability required by one real Activity plugin may belong in the framework when Guild Operations is the appropriate authority to provide it. Conversely, a capability should not be generalized merely because another hypothetical plugin might someday use it.

The framework standardizes authority and interoperability where Guild Operations requires them; it does not standardize away the procedural character that makes Activity plugins distinct.


### Language, ceremony, and bidirectional composition

The objective of the Activity framework is to establish the **language, ceremony, and procedure** through which Core and Activity plugins can discuss and accomplish the shape of an Activity.

This boundary is deliberately bidirectional. Activity plugins and Core are not opaque parties exchanging generic data. Both are parts of Guild Operations. They may understand Guild Operations concepts, understand what those concepts mean, and understand which domain has authority to establish, classify, resolve, or operate them.

The framework therefore does more than carry plugin output toward Core. It also lets plugin procedure ask Guild Operations for systemically understood values and capabilities.

A procedural component composes two dimensions:

- a **procedural kind**, whose meaning belongs to the plugin procedure; and
- a **shared type**, whose meaning is understood in Guild Operations language and whose authoritative construction, classification, or translation belongs to the appropriate systemic domain.

Conceptually:

```text
procedural kind        shared type
      │                    │
      └──── component ─────┘
                │
        ┌───────┴───────┐
        │               │
 plugin procedure   systemic capability
```

For example, a Raid procedure may require a value whose procedural meaning is willingness and whose shared type is `wow_spec`. Raid owns what willingness means to Raid. Guild Operations understands what a WoW specialization is and may have multiple legitimate ways to obtain, resolve, validate, or represent one.

This composition works in both directions.

When plugin procedure **requires** a typed value, the shared type is the question Core is being asked and the resolved value of that same type is the answer. The plugin need not prescribe how Core obtains it.

```text
plugin: willingness(? wow_spec)
                    ↓
Core obtains / resolves / constructs
                    ↓
plugin: willingness(! wow_spec(...))
```

When plugin procedure **provides** a typed value for systemic use, Core may use its understanding of that same type to represent or otherwise apply it without learning the plugin's procedural meaning.

```text
plugin: requirement(! wow_role(healer))
                    ↓
Core understands wow_role
                    ↓
Core chooses systemic representation
```

The procedural kind preserves why the value matters to the plugin. The shared type preserves what the value is to Guild Operations. Neither dimension transfers authority over the other.

> **Shared types describe what values are. Plugin-owned kinds describe what those values mean to a procedure.**

> **Components compose procedural meaning and systemic capability across the same boundary.**

The shared type contract describes semantic need, not acquisition or presentation mechanics. A request for `wow_spec` does not inherently request a selector, resolver callback, form control, Discord interaction, or any other producer-specific mechanism. Core may satisfy the same semantic request through different legitimate mechanisms while returning the same systemically understood type.

Likewise, a plugin projecting a `wow_spec`, `guildie`, or other shared type does not prescribe HTML, CSS, layout, or client behavior. Core may use the value through the capabilities for which Guild Operations has earned understanding.

This bidirectionality is a defining property of the Activity framework. A one-way framework in which plugins merely emit generic data for a host to interpret would discard the fact that both sides speak Guild Operations language and understand its authority boundaries. Conversely, allowing plugins to prescribe Core's acquisition or representation machinery would transfer systemic authority in the other direction.

The framework instead provides a shared semantic meeting point:

```text
                    Guild Operations language

plugin procedure  ←──── shared concepts ────→  Core capability
      │                                           │
owns procedural meaning                 owns systemic authority
      │                                           │
      └──────────── Activity framework ───────────┘
```

This is intentionally **the Guild Operations Activity framework**, not an attempt to discover a universal Activity or plugin model. Its language may contain Guild Operations-native concepts and translated World of Warcraft concepts because those are real meanings the product understands.

Examples of Guild Operations-native shared concepts include Guildie and guild Character. Examples of World of Warcraft concepts translated into Guild Operations language include `wow_class`, `wow_spec`, and `wow_role`. Ordinary value types such as string, boolean, and integer quantities may participate alongside them. Their presence in shared language does not imply identical ownership; the framework preserves where each meaning originates and who may authoritatively establish it.

New vocabulary and ceremony are earned by concrete Guild Operations requirements. The framework should not acquire generic schema machinery merely to accommodate hypothetical plugin concepts. When a real Activity procedure cannot faithfully compose its meaning from the language and capabilities Guild Operations already understands, that pressure is evidence for considering an extension to **this** framework.

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

Where procedure intentionally depends on time, the same authority boundary still applies. A plugin may define a cutoff or other temporal condition and evaluate that fact when an actor requests an operation. The passage of time may therefore make a later operation inadmissible under already-declared terms without itself changing persisted procedure. If satisfying a temporal condition is intended to create new durable procedural truth, that change still requires legitimate procedure and declaration; the declaring actor may be a person or authorized automated machinery when the plugin grants it that role.

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

This shared language is not an opaque interchange vocabulary. Core and Activity plugins may understand the same systemic concepts. Authority determines who may establish or classify a fact, not who may understand or use it.

Core owns the authoritative construction and classification of the systemic concepts it provides. An Activity plugin may request those concepts, receive them in their systemic form, understand their meaning, and compose them into plugin-owned procedure without learning or reproducing the Core machinery that established them.

Conceptually, the framework relationship is:

```text
plugin
  "Give my procedure these things."
        ↓
Core
  "I know what those things are,
   and I have authority to construct them."
        ↓
plugin
  "I know what they mean,
   and I know what my procedure does with them."
```

For example, a plugin may declare that its procedure requires a guild Character without reimplementing the identity and roster machinery that determines whether a Character qualifies. Core resolves the classification and provides the systemic concept; the plugin understands that concept and decides what requiring it means to its procedure.

> **The framework shares language without sharing authority.**

> **Shared vocabulary does not imply shared motivation.**

> **Knowing a word is not authority to decide what the speaker means by using it.**

## Actor identity

An **Actor** is an identified party that Activity procedure can durably reference. Identification is constitutive of Actorhood; an unidentified or merely labelled subject is not an Actor in Activity vocabulary.

Actor identity may be established by Guild Operations or by another identity authority available through an integration. The authority may differ without weakening the invariant. A Guildie identifier and a durable externally-authoritative subject identifier can both identify Actors; an unresolvable display name or other ungrounded label cannot.

Activity plugins may constrain which Actors their procedure accepts according to meanings they own, such as organizational eligibility. Those constraints answer whether an already-identified Actor is eligible for the procedure. They do not determine whether the party is an Actor in the first place.

```text
subject encountered
      │
      ▼
identifier resolved?
  │           │
 yes          no
  │           │
  ▼           ▼
Actor      unresolved subject
  │
  ▼
plugin-owned eligibility
  │
  ▼
Activity procedure
```

This invariant applies to all Activity Participation, including procedures with no explicit Offer. Fulfillment may be discovered rather than consciously offered, but Activity cannot establish a Participation observation until the participating party is an Actor.

> **An Actor has a durable identifier by definition. If a party cannot be resolved to an identifier, Activity cannot establish Participation for that party.**

> **Eligibility constrains Actors; it does not create them.**

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

## Participation fulfillment

Where an Activity procedure accepts an explicit Participation Offer, the contract between plugin procedure and Activity distinguishes three independent concerns:

- **Actor constraints** describe which already-identified Actors may participate.
- **Offer requirements** describe the semantic values the plugin procedure requires from the Offer.
- **Fulfillment constraints** describe which authoritative or declarative sources may be used to establish the candidate values from which the participant makes that Offer.

These concerns must not be collapsed into one another. In particular, a shared semantic request such as `wow_spec` describes the value Raid needs; it does not itself prescribe whether that value must be reached through a controlled Character, a guild-roster Character, or a declared class. Likewise, satisfying Actor eligibility does not prove that an offered value was derived through a source permitted by the procedure.

A fulfillment surface may choose how to present the permitted route, but it must preserve the participant's decisions. Earlier choices may establish or narrow the candidate set for later choices; they do not make those later choices on the participant's behalf.

```text
Actor constraint
    │ identifies who may proceed
    ▼
permitted fulfillment sources
    │ participant establishes input/provenance
    ▼
Core/system authority derives candidate values
    │ participant chooses from candidates
    ▼
Offer requirement satisfied
```

For example, a Raid may require `wow_spec[]` while permitting a class pool to be established precisely from known controlled Characters or coarsely from declared classes. Character selection and class declaration are therefore alternative resolutions of an upstream fulfillment choice, not different meanings of `wow_spec`. Core may derive the candidate specializations from the resulting class pool, but it may not silently choose the class pool or the offered specializations for the participant.

The Activity boundary validates both the semantic Offer values and, where procedure constrains fulfillment, that their provenance was established through a permitted source. A rendering or transport surface is not trusted to make that guarantee merely by hiding invalid choices.

> **Actor constraints govern who may participate. Offer requirements govern what the procedure needs. Fulfillment constraints govern how candidate values may legitimately be established.**

> **A fulfillment step may constrain the choices available to the next step. It does not make the next choice.**

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

Core rendering authority does not require plugins to flatten unique procedure into generic presentation. An Activity plugin may communicate the semantic shape it expects represented without prescribing HTML, CSS, client behavior, or another concrete rendering implementation. A Raid assignment workspace, for example, may legitimately require a richer procedural shape than an ordinary collection of records even though Core remains responsible for how that shape is rendered.

Core ownership of rendering therefore creates a corresponding framework responsibility: Activity must provide enough expressive machinery for concrete plugin procedure to be represented faithfully without transferring rendering authority to the plugin.

> **A plugin may own the semantic shape of its procedure without owning its rendering.**

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
