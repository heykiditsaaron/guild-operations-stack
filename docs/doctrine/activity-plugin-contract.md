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

Examples of Guild Operations-native shared concepts include Identity, Actor, the derived Guildie classification, and guild Character. Examples of World of Warcraft concepts translated into Guild Operations language include `wow_class`, `wow_spec`, and `wow_role`. Ordinary value types such as string, boolean, and integer quantities may participate alongside them. Their presence in shared language does not imply identical ownership; the framework preserves where each meaning originates and who may authoritatively establish it.

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

A plugin may understand and compose concepts such as Identity, Actor, the derived Guildie classification, Character, guild Character classification, Role, Spec, rank, time, quantity, and Core capabilities into its procedure. Sharing those concepts does not transfer authority over them.

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

## Requests, fulfillment, and procedural necessity

Activity plugins do not acquire systemic authority merely because their procedure needs a systemic concept. When a plugin needs meaning owned outside its procedure, it **requests** the appropriate Core capability and consumes the authoritative result Core can provide.

A plugin may make successful fulfillment of that request a condition of its own procedure only when the result is genuinely necessary to that procedure. For example, Raid may require Core to resolve the actor identity behind a Participation Offer. If Core cannot resolve that identity, Raid cannot establish meaningful participation; failure of the Core-owned capability therefore makes the Raid procedure unable to proceed without making identity Raid-owned.

This differs from a request whose result is not procedurally necessary. Representation is the clearest example. A plugin may request that Core represent an identity as a character, or even prefer a particular character when that context is available. The plugin does not insert the representation, resolve it, or make successful presentation a procedural condition merely because it expressed a preference. Core owns representation resolution, fallback, and rendering.

```text
plugin procedure
    │
    ├── requires systemic meaning
    │      ↓ request
    │    Core fulfills authoritatively
    │      ↓
    │    unresolved → procedure may be unable to proceed
    │
    └── requests non-procedural expression
           ↓ request
         Core resolves / degrades / falls back
           ↓
         procedure remains unchanged
```

The distinction is semantic necessity, not ownership. Plugins necessarily depend on concepts they do not own. A plugin decides whether its procedure genuinely requires a Core-owned result; it does not gain authority to establish that result itself.

> **Plugins request. Core fulfills under the authority of the domain that owns the requested meaning.**

> **A Core-owned result may be procedurally required without becoming plugin-owned. A presentational request must not acquire procedural significance merely because a plugin requested it.**

> **The framework shares language without sharing authority.**

> **Shared vocabulary does not imply shared motivation.**

> **Knowing a word is not authority to decide what the speaker means by using it.**

## Actor identity

Activity consumes the Core Actor contract; it does not establish an alternate Activity-specific identity system.

An **Actor** is an accepted Identity authoring an action. Core identity resolution supplies:

- **subject** — the canonical Identity to which GO resolves and attributes the Actor;
- **origin** — the Identity through which the action entered GO.

For a self-resolving Identity, subject and origin are the same. When an external Identity is associated with a GO-recognized WoW Account Identity, the WoW Account Identity is the Actor subject and the external Identity remains the origin.

```text
native WoW:
  origin A → subject A

unassociated external:
  origin B → subject B

associated external:
  origin C → associated WoW A → subject A
```

Activity procedure constrains already-resolved Actors according to meanings the procedure owns. Eligibility does not create Actorhood, and Activity plugins must not reproduce cross-authority association or Actor resolution.

A Participation Offer represents one Actor. Offer ownership and other procedure that requires singular Actor identity use the resolved Actor subject. Provider-specific provenance or representation may additionally use origin when relevant.

This permits guest participation without requiring association first. An unassociated external Identity can be a valid Actor for an `Any` procedure while remaining unable to satisfy WoW-derived constraints. If that external Identity is associated with a WoW Account Identity, the same ingress can resolve to the WoW-backed Actor subject and therefore gain access to the authoritative WoW context available to that subject.

> **Identity establishes who can be recognized. Actor resolution establishes the canonical author. Procedure establishes whether and how that Actor may participate.**

> **One Participation Offer represents one resolved Actor subject, even when multiple associated Identities can originate actions for that Actor.**

## Participation

Participation is an optional systemic Activity observation: a party participated in an Activity occurrence. An Activity need not produce Participation observations.

Participation is not itself procedure. A plugin owns whatever procedure gives it authority to establish that observation. Where explicit offering is part of that procedure, the Offer itself is nevertheless Core-owned Participation machinery rather than plugin-owned procedure. One maximally expressed participation-related procedure is:

```text
Terms → Offer → Conditions → Fulfillment → Adjudication → Participation
```

This is semantic structure, not six mandatory persisted states, objects, interactions, or transitions.

- **Terms** define the standing proposition of the Activity procedure.
- **Offer** is the Core-owned Actor-bound declaration constructed under the occurrence's Participation request, carrying the procedure context that request requires.
- **Conditions** define what must be true for the relevant participation to be considered fulfilled.
- **Fulfillment** is the reality that may satisfy those Conditions.
- **Adjudication** is successful procedure declaring whether the relevant fulfillment counts.
- **Participation** is the resulting systemic observation recognized by Activity.

An Activity plugin owns the procedure around these meanings; Core owns the systemic Participation machinery it provides, including explicit Participation Offers. These stages are not a mandatory Activity lifecycle or required ceremony. They may be explicit, richly negotiated, mechanically evaluated, human-evaluated, inherent, or absent as separately expressed artifacts when the procedure does not require them.

Participation does not require conscious enrollment or negotiation. A procedure may discover fulfillment and adjudicate Participation for an actor who made no explicit Offer, such as an achievement- or activity-scoring procedure. An explicit Offer is therefore an optional ceremonial artifact, not a universal prerequisite for Participation.

Where an explicit Offer exists, the participant remains authoritative for that Offer while it is outstanding and the procedure permits rescission. Successful adjudication into Participation settles the Offer; it becomes historical provenance rather than an outstanding declaration that can still be rescinded.

Fulfillment and adjudication remain distinct. Reality may satisfy Conditions before an authorized operator or other procedurally authorized evaluator declares that it counts. Core machinery may provide authoritative observations used by the procedure, but those observations do not autonomously advance plugin procedure.

Activity owns the resulting systemic Participation observation so consumers can use it without understanding Raid signup, Raffle claims, achievement scoring, or another plugin's procedure. Procedural references or Offers may be retained as provenance without becoming the meaning of Participation.

> **Procedure establishes why the observation is legitimate. Activity owns what the Participation observation means systemically.**

## Participation Offers and occurrence relationships

A **Participation Offer** is a Guild Operations-owned systemic object. It belongs to its Actor and points to the Activity occurrence whose procedure invited or accepts the Offer. The Activity plugin owns that occurrence's procedure; it does not own the Offer merely because the Offer points to its occurrence.

Likewise, Guild Operations does not acquire authority over plugin procedure merely because a Core-owned Offer points to the occurrence.

Conceptually:

```text
Actor
  │
  │ owns / authors
  ▼
Participation Offer ───── points to ─────► Activity occurrence
      Core-owned                            plugin procedure
```

The occurrence-side collection of Offers may be derived from the persisted Offer-to-occurrence relationships rather than separately persisted. What matters to the contract is that the relationship is traversable: given an occurrence, Guild Operations can resolve the Participation Offers pointing to it and, through those Offers, their Actors.

This relationship deliberately preserves enough systemic meaning for future change-transfer machinery without prescribing that machinery now. In particular, the model must be capable of expressing both directions:

```text
occurrence changed
    ↓
Offers pointing to occurrence
    ↓
Actors belonging to those Offers
```

and:

```text
Participation Offer changed
    ↓
occurrence the Offer points to
    ↓
Activity plugin responsible for that occurrence's procedure
```

A future transport, event, emission, or other transfer mechanism may use these relationships to inform affected identities when an occurrence changes, or to inform the responsible procedure when an Offer changes. The Activity/Participation contract does not define that future transfer API or claim that such propagation is currently implemented.

The important invariant is authority preservation. Being able to identify, traverse to, or inform the other side of the Activity boundary does not confer ownership of that side's meaning. Guild Operations remains authoritative for the Offer and Actor relationship. The Activity plugin remains authoritative for its occurrence procedure and for the procedural consequences of an Offer change.

> **Participation Offers belong to Actors, are owned systemically by Guild Operations, and point to Activity occurrences whose procedure remains plugin-owned.**

> **The Offer/occurrence relationship is traversable in both directions without transferring authority across the Activity boundary.**

## Participation Offer requests and fulfillment

Where an Activity procedure accepts explicit Participation Offers, the plugin declares the Participation request under which those Offers may be constructed.

The declaration has two dimensions:

- **eligibility** describes the population of Actors from which Participation Offers may be constructed for the occurrence;
- **context** describes the appropriately typed information each resulting Offer must carry for the requesting procedure.

Eligibility does not establish Actorhood. Core resolves the Actor first; the occurrence's Participation eligibility then determines whether that Actor may construct an Offer.

A context request describes one procedurally significant fact of one system-recognized kind. The plugin gives that fact its procedure-local name, declares the recognized kind, may apply constraints supported by that kind, and declares whether multiple values are permitted. The plugin owns why the named fact matters to its procedure. The authority that owns the shared kind remains authoritative for what values of that kind mean and how they may be established.

Conceptually:

```text
Participation request
│
├── eligibility
│   └── eligible population
│
└── context[]
    ├── declared name
    ├── recognized kind
    ├── allow multiple
    └── constraints supported by that kind
```

The request describes required Offer meaning, not acquisition or rendering instructions. It does not prescribe selectors, callbacks, source lists, layouts, controls, or plugin-specific payloads. Core owns how satisfying values are acquired, validated, composed, represented, and persisted.

Every Participation Offer is Actor-bound even when the plugin requests no additional context. An empty context declaration therefore remains meaningful: the procedure needs an Offer from an eligible Actor but requires no additional Offer context. Plugin procedure references the Offer, not the Actor directly.

For each named context request, `allowMultiple: false` requires exactly one value of the declared kind. `allowMultiple: true` permits one or more values and Core represents the fulfilled context as a non-empty homogeneous array of that declared kind. Multiplicity does not change the kind itself. If a procedure needs facts of different kinds, it requests multiple named context entries.

```text
{ name: "character", kind: "guild_character", allowMultiple: false }
    ↓
exactly one guild_character

{ name: "offered_specs", kind: "wow_spec", allowMultiple: true }
    ↓
one or more wow_spec values
    ↓
non-empty wow_spec[]
```

Appropriate kinds are Guild Operations or shared domain vocabulary that Core can authoritatively understand, validate, acquire, and persist. A plugin-specific procedural concept does not become Participation context merely because the plugin would find it convenient to attach to an Offer. Richer Offer context is composed from multiple appropriate named requests rather than an opaque procedural payload.

> **Eligibility declares the population from which Participation Offers may be constructed. Context declares what appropriately typed information those Offers must carry for the requesting procedure.**

> **Plugins request. Core fulfills under the authority of the domain that owns the requested meaning.**

### Participation Offer construction

Core renders and operates the **Participation Offer workspace** from the Participation request. The workspace is a consequence of the request and Core's knowledge of recognized kinds, not a second presentation contract authored by the plugin.

A recognized kind owns acquisition and validation of one canonical value. The named context request owns composition: exactly one value when multiple values are not permitted, or one or more values when they are. Multiple named requests compose independently into the Offer context.

```text
eligible Actor
   +
Participation request
   ↓
Participation Offer workspace
   ↓
Core acquires / validates requested values
   ↓
all requested context satisfied
   ↓
Participation Offer established
```

The browser surface and server-side constructor are two expressions of the same Participation semantics. A browser may help an Actor choose valid candidates, but the server independently establishes and validates the submitted values. Rendering is never the authority boundary.

During construction there may be incomplete workspace state that is not yet a Participation Offer. A persisted Offer is established only when its Actor and all requested context satisfy the request. Participation does not require durable draft Offers merely to represent incomplete construction.

### Revision and request replacement

An outstanding Participation Offer may be revised while the Participation request under which it was constructed remains the same. Existing context values are already-established canonical values under that request. Retaining them does not require reacquisition. Newly supplied values require acquisition and validation; removed values cease to be part of the revised Offer. The resulting context must still satisfy the same multiplicity and kind constraints.

A change to the Participation request is different from revision of an Offer. The request is the contract under which its outstanding Offers were constituted. Changing that contract establishes a new Participation request and makes outstanding Offers under the previous request null and void. Participants begin again under the new request. Ordinary occurrence changes that leave the Participation request unchanged do not invalidate outstanding Offers.

This is a semantic invariant, not a requirement for speculative request-version persistence. Concrete replacement machinery should be introduced when an Activity exposes a real mutable Participation-request path.

> **An Offer may be revised under the request that constituted it. It is not reinterpreted under a different request.**

> **Changing the Participation request establishes a new request and invalidates outstanding Offers constituted under the previous request.**

### Accessibility and procedural dependency

Participation Offers are Core-owned application objects and are not hidden from Activity plugins. A plugin may query a full Participation Offer through the ordinary application contract.

Accessibility does not imply procedural dependency. The plugin's participation procedure operates on the Offer reference and the procedure context it requested. Other Core-owned Offer facts remain available where legitimately useful without becoming additional undeclared inputs to the participation procedure.

Nothing is sent to a plugin for opaque processing. Core constructs and owns the Offer; plugin procedure reads the Offer reference and the requested context relevant to that procedure.

> **A full Participation Offer may be queried through the application contract, while the requesting procedure depends on the Offer reference and the context it requested.**

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
