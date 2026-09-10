# Event Participation Discovery

## Status

This document preserves design discovery for a projected Guild Operations Event module and related event-shaped activities.

It is guidance, not doctrine, and it is not an implementation specification. The concepts here were discovered by pressure-testing different guild activities against one another. They should help later design work recognize useful common structure without forcing activities to conform to a generic lifecycle.

The central observed convergence is:

> **Opportunity → Operation → Participation → Result**

This is a map for reasoning about participation, not a requirement that every event implement four states, four interfaces, four persistence objects, or a fixed state machine. When a real guild activity contradicts this map, the activity wins.

## Mechanical Guild Event boundary

The participation progression above does not define what mechanically constitutes a Guild Event. That question has a smaller answer.

> **A Guild Event is defined mechanically by conformance to its required metadata contract, not by declaration or operational behavior.**

At minimum, a Guild Event must establish:

- `occurs_at_unix` — the authoritative temporal coordinate occupied by the event, represented as an instant or range according to the established Unix-time contract;
- `label` — the human-recognizable label for what occupies that temporal slot.

A module does not make an object a Guild Event merely by calling it one, exposing event-like routes, or implementing participation machinery. Without the required metadata, the object is not mechanically a Guild Event.

This deliberately defines **event-ness without defining event operation**.

A raid may operate through applicants, Character context, roles, approvals, assignments, confirmations, and attendance. A raffle may operate through claims, tickets, draws, winners, and winnings. Hidden in Plain Sight may operate through entirely different game rules. Those operational models remain owned by the emanating module and do not need to conform to a universal Guild Event lifecycle or state machine.

The shared contract standardizes how the wider application understands that these different activities are Guild Events. It does not standardize what participation in them means.

## Standardized event metadata enrichment

Once an object satisfies the required Guild Event metadata contract, Guild Operations provides standardized optional vocabulary through which its module may enrich how consumers understand and approach it.

Current enrichment concepts include:

- `description` — additional human-readable understanding of the event;
- `tags` — standardized classification or interpretation metadata;
- `interactions` — standardized metadata describing available approaches to module-owned operation.

These enrichment fields are optional to produce and optional to consume. Their absence does not make an otherwise conforming object less of a Guild Event.

Their vocabulary is nevertheless contractual when used. A module may omit `interactions`, but it cannot invent an unrelated field such as `buttons` and expect generic Guild Event consumers to understand it as the shared interaction surface.

The governing rule is:

> **Guild Event metadata standardizes vocabulary, not completeness. Production is optional. Consumption is optional. Conformance is required when the shared vocabulary is used.**

This also permits partial consumer literacy. A Calendar consumer may understand only temporal coordinates, labels, and selected enrichment. A Discord consumer may understand additional tags or interactions. An unfamiliar standardized enrichment or interaction does not invalidate the event; a consumer can ignore what it does not understand and use what it does.

### Interactions as the operation seam

`interactions` is where module-owned operation can meet expansion into other surfaces without moving operational authority into Guild Event machinery.

An event may expose no interactions or a large interaction surface. A raid might eventually advertise concepts such as manage, join, decline, or subscribe. The exact interaction-object shape is intentionally not fixed by this discovery document; it should be earned through implementation pressure.

What is already important is the authority boundary:

> **Interactions may describe ways to approach module-owned operation. They do not relocate that operation into the Guild Event contract.**

A consumer may learn how to present or invoke a standardized interaction without learning the originating module's entire operational model. The module remains authoritative for what the interaction means, whether it is permitted, what context it requires, and what operation follows.

This allows consumers to become more capable independently. Calendar, Discord, web presentation, notifications, and future consumers can each understand as much standardized enrichment as is useful to their medium without forcing modules to reduce their event surface to the least-capable consumer.

## Metadata ownership and authority

The emanating module owns its Guild Event metadata as part of its authoritative state. Its own presentation and generic consumers should consult the same metadata fields rather than maintain peer copies of event-description truth.

For example, a raid's authoritative `label` should be the same `label` used by the raid's own web presentation, Calendar, Discord, and any future Guild Event consumer. A module-specific `raid_title`, a copied Calendar title, and a copied Discord title representing the same fact would create unnecessary concurrent truths.

The same principle applies to temporal coordinates and standardized enrichment.

> **A consumer should not own a second authoritative version of an event-description fact merely because it needs that fact to render.**

Consumers may express the same metadata differently because their mediums differ. Calendar may render an event spatially in time; Discord may render it as a message or component surface. Those are presentations of the same module-owned metadata, not independent ownership of the underlying facts.

This minimizes authority conflicts while leaving module sovereignty intact:

- the module owns what its event is and how it operates;
- the Guild Event contract owns the shared language by which event-ness and standardized enrichment are understood;
- consumers decide which parts of that language they can use;
- no consumer becomes authoritative merely by presenting the event.

The resulting balance is intentional:

> **Guild Operations defines what it means for an activity to be understood uniformly as a Guild Event. The emanating module defines what that Guild Event means to operate and participate in.**

## Why this discovery matters

Guild participation takes many forms. Raids, housing competitions, fashion shows, raffles, scavenger hunts, achievement runs, Mythic+ groups, guild photos, and other activities can have very different rules and outcomes.

They nevertheless create recurring friction between the people offering participation and the people trying to participate. Organizers need sufficiently shaped information to operate an activity. Applicants need to understand what meaningful participation requires without reconstructing that requirement from Discord messages, follow-up questions, spreadsheets, or assumptions.

The useful commonality is therefore not that all events behave alike. It is that many activities move through a recognizable progression from an opportunity to participate, through whatever operation is necessary, into actual participation, and sometimes into a distinct result.

Commonality is strongest near Opportunity and becomes progressively more contextual afterward.

## Opportunity

Opportunity is the region in which participation is offered and sought.

It answers questions such as:

- Who is allowed to seek participation?
- What must an applicant provide or express?
- What does taking part in this particular opportunity require?

Several concepts have repeatedly survived pressure testing here.

### Eligibility

Eligibility answers **who is allowed**.

Current useful distinctions are:

- **Anyone** — Guild Operations identity is not required. If a known identity relationship exists, it may be projected; otherwise the system must not invent one.
- **Guildie** — the applicant must resolve to a current Guildie.
- **Guild character** — participation must be expressed through a currently controlled character that is currently on the guild roster.

Eligibility is not approval. Someone may be eligible without applying, and an eligible applicant may still require an organizer's approval.

### Applicant and intent

An **Applicant** is an actor seeking to take part. The applicant authors **Intent**.

Intent is the applicant's expression that they want to participate, together with whatever applicant-authored context the opportunity requires.

Applicant is an authority relationship around the event, not a new identity type. A Guildie may be both an Applicant and an Organizer.

### Participation Context

Participation Context answers:

> **What must an applicant tell us, and what does taking part in this opportunity look like?**

This is where much of an event's useful shape appears.

A housing competition might require almost no context beyond eligible entry. A fashion show may require a Character. A Mythic+ group may require a Character and expose five role-shaped places. A progression raid may require substantially more precise Character, role, specialization, or availability context.

Concepts such as composition, slots, capacity, WoW role, and presets have not earned independent universal status. They can currently be understood as ways Participation Context may be constructed or authored.

Presets are especially useful as authoring shortcuts, but should not automatically become event kinds. A "10-player raid" preset can populate useful Participation Context without requiring the backend to treat `10-player raid` as a fundamental domain category.

## Operation

Operation is the region where expressed intent is acted upon.

It may include:

- Organizer authority
- Approval
- Assignment where constrained Participation Context requires it
- Activity-specific preparation or procedure

An **Organizer** is an actor with authority to operate the opportunity. Automatic procedure does not create a new authority: automation executes policy established by the organizer or activity.

### Approval

Approval answers the broadly reusable question:

> **Has this applicant's intent been accepted into the activity?**

Approval is distinct from eligibility and distinct from actual participation.

A person may be eligible, apply, and be approved, yet never actually participate.

### Assignment

Assignment is useful but has not proven to be an irreducible event primitive.

It answers a narrower operational question:

> **If approval is constrained by Participation Context, where does this approved intent fit?**

For a raid, assignment may be substantial because the opportunity has strongly structured places. For an unlimited housing competition, approval may require no assignment at all. For a raffle, forcing ticket creation into a generic Assignment abstraction would discard useful raffle-specific meaning.

Assignment should therefore remain optional operational machinery unless further activities prove a stronger common abstraction.

Authorship must remain visible. "Aaron applied as damage" and "Aaron was assigned tank" are different facts even if both ultimately concern the same participation.

## Participation

Participation is the factual boundary where participation actually occurs.

This distinction matters because participation cannot be compelled by software or by an organizer. Approval does not make somebody a Participant.

A person can:

- be eligible and never apply;
- apply and never be approved;
- be approved and never participate; or
- in some activities, legitimately participate without having followed the normal pre-event path.

For that reason, **Participant is better understood as an observation or projection over what actually happened than as a pre-event actor primitive or lifecycle status.**

The threshold that establishes participation belongs to the activity.

Examples:

- In a raid, an approved roster member may still no-show; actual involvement realizes participation.
- In a raffle, an accepted entry or its resulting tickets may themselves constitute asynchronous participation.
- In a housing competition, an accepted or submitted entry may constitute participation even when the entrant is absent during judging.

Presence and participation are therefore not synonymous.

Historical participation should remain meaningful even when current eligibility later changes. Current membership can govern whether an action is allowed now without rewriting what actually happened in the past.

## Result

Result is where the activity is most free to assert its own meaning.

Some activities have a strong, distinct result:

- a raffle establishes a winner and winnings;
- a housing competition may establish placements or awards;
- Hidden in Plain Sight may resolve according to its game mode.

Other activities may have no useful result beyond participation itself. A raid does not require a universal Result object merely because another event does.

Result is therefore contextual and optional. No universal result schema has been earned.

Two questions should remain activity-owned:

1. **What counts as participation?**
2. **What does that participation produce, if anything?**

## The geometry model

A useful way to reason about Opportunity is as geometry.

**Opportunity defines the hole. Participation Context communicates the shape of a fitting piece. The applicant expresses Intent in that geometry. Operation fits or bounds those pieces. Participation is the shape actually being realized. Result, where meaningful, is what the completed shape produces or means.**

Different activities create differently complex shapes.

A housing competition may be close to an oval: almost any eligible entry fits. A progression raid may be a much more complex shape because Character, role, specialization, availability, composition, and limited places can all matter.

The goal is not to force a generic applicant through a complicated hole. It is to expose the opportunity's geometry early enough that applicants can express intent already shaped appropriately.

In that sense, Guild Operations should create the conditions for a participant to produce a rhombus-shaped piece for a rhombus-shaped hole rather than repeatedly trying to push an egg through it.

This reduces friction on both sides:

- applicants can see what meaningful intent needs to contain;
- organizers receive intent shaped well enough to operate directly.

A useful design test is:

> **Does this help the opportunity express its shape, help the applicant produce appropriately shaped intent, or help the organizer operate the resulting pieces?**

Complexity should remain proportional to the opportunity. A simple activity should not inherit raid-level machinery merely because raids need it.

## WoW-authored geometry

Not all useful geometry is authored by Guild Operations.

Blizzard already authoritatively establishes facts about WoW objects and relationships, including Character identity and other Blizzard-owned Character, account, and guild facts. Guild Operations should neither create parallel truths for those facts nor throw away useful truth that is already available.

The guiding principle is:

> **Preserve authoritative geometry; constrain only the dimensions the opportunity actually cares about. Do not fight WoW-authored geometry, and do not waste it.**

A raid may care deeply about Character, guild membership, class, specialization, or role compatibility. A fashion show may require a Character while ignoring specialization and role. A housing competition may care only that an applicant is a Guildie.

Ignoring a dimension for a particular opportunity does not erase or override the underlying fact. The opportunity simply does not constrain participation along that dimension.

This preserves the authority boundary:

- Blizzard owns the facts Blizzard establishes.
- Guild Operations owns what guild-authored opportunities require those facts to mean for participation.

The event's hole is deliberately mutable even though the pieces retain their authoritative geometry.

## Derived participation subject and representation

The effective participation subject should be derived from the intersection of **eligibility** and **applicant-side Participation Context**, not selected independently by an organizer.

Examples:

- Guildie eligibility with no Character context yields a Guildie participation subject.
- Guildie eligibility with selected Character context remains the same durable Guildie actor while carrying that Character as meaningful participation context.
- Guild character eligibility necessarily constrains the selected Character to the currently controlled/current-roster intersection.
- Anyone eligibility may project a known Guildie relationship when one exists, while allowing event-local identity where it does not.

Role and specialization may shape participation but do not become identity.

Presentation is downstream of these facts. Organizers configure participation rules; the system derives representation from identity, participation context, and surface. A selected main can remain a useful web recognition surface without silently replacing a Character that is specifically meaningful to an event.

## Concepts deliberately not universalized

Pressure testing has repeatedly made the model smaller rather than larger.

The following concepts are useful in some activities but have not earned status as universal event primitives:

- **Participant lifecycle** — Participant emerges from actual participation.
- **Composition** — currently a way Participation Context may be constructed.
- **Slots** — currently Participation Context machinery.
- **Capacity** — can be expressed through bounded or unbounded Participation Context where needed.
- **WoW role** — contextual specialization, not identity.
- **Presets** — authoring shortcuts, not persisted event kinds by default.
- **Assignment** — optional operational machinery.
- **Representation** — derived from identity, context, and surface.
- **Result schema** — activity-owned and optional.
- **Generic event sourcing** — not justified merely because meaningful transitions and authorship need preservation.

Existing activity-specific vocabulary should also survive where it carries real meaning. A raffle can continue to own claims, tickets, draws, winners, and winnings rather than translating those concepts into generic event nouns simply because conceptual parallels exist.

## Pressure-test examples

### Progression raid

Opportunity can expose Guildie or guild-character eligibility and precise Participation Context around Character, role, specialization, availability, and constrained places. Applicants submit shaped intent. Organizers approve and may assign that intent into a deliberate roster. Approval does not guarantee attendance; participation is realized by actual raid involvement. A separate Result may not be necessary.

### Housing competition

Opportunity may be Guildie-only with little additional Participation Context and potentially unlimited entries. Operation may be little more than accepting an entry. The submitted or accepted entry can itself realize asynchronous participation. Judging and awards may later establish a distinct Result without requiring the entrant to be present.

### Fashion show

Opportunity may require a Character while leaving class, specialization, and role irrelevant. It may have bounded or unlimited places. Participation is creative presentation rather than combat composition. Judging or awards can be activity-specific Result machinery.

### Raffle

The raffle's existing domain vocabulary already maps usefully onto the discovered progression without needing to be replaced by it. A live round offers an Opportunity. A claim expresses Intent. Claim approval operates that intent and creates the raffle-specific ticket population. Accepted entry/tickets realize asynchronous participation. The draw establishes the raffle's strongly meaningful Result: winner and winnings.

### Hidden in Plain Sight

The opportunity establishes the exploration or deduction challenge and whatever eligibility and Participation Context its game mode requires. Operation and the threshold for participation can vary by mode. Resolution is game-specific and remains owned by Hidden in Plain Sight rather than by generic event machinery.

## Guidance for future design

`Opportunity → Operation → Participation → Result` should be treated as a treasure map: it identifies terrain that repeatedly appeared while examining real guild activities.

It should help answer questions such as:

- Is this requirement describing how participation is offered, how intent is operated, what actually constitutes participation, or what the activity produces afterward?
- Is a proposed abstraction genuinely shared, or are two activities merely using similar words for different domain behavior?
- Are we preserving useful authoritative facts or asking members and organizers to restate geometry the system already knows?
- Are we adding machinery because a real activity requires it, or because a generic event platform can be imagined?

The map is allowed to be wrong. A future guild activity that does not fit should pressure the model rather than be distorted to preserve it.

The strongest current guidance is therefore not a fixed lifecycle. It is:

> **Shape the opportunity clearly enough that people can respond to it in kind. Preserve authoritative geometry, automate useful procedure, and let each activity retain ownership of what participation and result actually mean.**
