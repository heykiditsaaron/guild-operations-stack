# Event Participation Discovery

## Status

This document preserves design discovery for a projected Guild Operations Event module and related event-shaped activities.

It is guidance, not doctrine, and it is not an implementation specification. The concepts here were discovered by pressure-testing different guild activities against one another. They should help later design work recognize useful common structure without forcing activities to conform to a generic lifecycle.

The central observed convergence is:

> **Opportunity → Operation → Participation → Result**

This is a map for reasoning about participation, not a requirement that every event implement four states, four interfaces, four persistence objects, or a fixed state machine. When a real guild activity contradicts this map, the activity wins.

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
