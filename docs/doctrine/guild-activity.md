# Activity

An **Activity** is a first-class Guild Operations occurrence whose concrete procedure is owned by an **Activity plugin**.

Activity belongs to Core. It gives concrete plugin procedure a stable systemic identity and translates Activity-relevant truth into the rest of Guild Operations without making Core authoritative for that procedure.

The detailed plugin boundary is defined by [Activity Plugin Contract](activity-plugin-contract.md).

## Occurrence and procedure

An Activity occurrence exists because an authorized actor successfully completes the establishment procedure defined by its Activity plugin.

Activity does not infer establishment from surrounding facts, a temporal coordinate, or the existence of plugin working state. The plugin owns what must be defined, aligned, supplied, or otherwise satisfied for establishment to succeed. Core owns the authority and systemic primitives the procedure consumes; Activity gives the successful declaration systemic meaning.

The same boundary applies while an occurrence evolves. Plugin-owned procedure may contain arbitrary working concepts and operations. Only the results that have Activity-wide significance cross into Activity as declarations or projections.

> **Core machinery owns capability. Activity owns translation. Activity plugin procedure owns meaning.**

## Lifecycle

Activity lifecycle vocabulary is deliberately small:

```text
nothing
   │ established
   ▼
ACTIVE
   │ plugin-owned evolving procedure
   │ concluded
   ▼
RECORD
```

**Established** and **Concluded** are transitions produced by successful plugin procedure. **Active** and **Record** describe what the occurrence is.

**Active** means the occurrence remains procedurally evolvable. It does not mean the Activity is happening now, Participation is open, or the Activity appears on Calendar.

**Record** is the same occurrence identity after terminal conclusion. Conclusion is not inferred merely because time passed or another observable circumstance became true. The plugin owns the terminal procedure and the meaning by which it succeeds; Activity owns the systemic consequence that the occurrence is thereafter a Record.

Cancellation, completion, drawing, expiration, closeout, or another terminal operation may be concrete plugin language. Those terms do not become universal Activity lifecycle states merely because a plugin uses them.

## Temporal relevance

Temporal relevance is independent of lifecycle.

An Activity may project a temporal coordinate when its procedure says that coordinate is systemically relevant. Activity translates that projection for Calendar; Calendar plots the reference at the supplied coordinate.

Calendar presence does not establish an Activity, and withdrawing Calendar projection does not conclude or destroy one. Time passing does not independently advance plugin procedure.

> **Procedure interprets. Activity translates. Calendar plots.**

## Participation

Participation is an optional systemic Activity observation:

> a party participated in an Activity occurrence.

Participation itself is not the plugin procedure that establishes whether participation occurred.

A plugin may use commitments, assignments, claims, conditions, fulfillment, adjudication, discovered facts, or entirely different procedure before it has authority to establish the Participation observation. Those concepts remain plugin-owned unless they independently earn systemic meaning.

A maximally expressed participation-related procedure may resemble:

```text
Terms → Offer → Conditions → Fulfillment → Adjudication → Participation
```

That is a possible route to the Participation observation, not six mandatory Activity states, persisted objects, or transitions. An explicit Offer is optional. Participation does not require conscious enrollment or negotiation.

Where an Offer exists, it is a procedural artifact and may become provenance for a resulting Participation observation. Likewise, other procedural references may explain why the plugin had authority to establish the observation without becoming part of Participation's systemic meaning.

Terms, eligibility, Conditions, fulfillment, and adjudication retain their distinct procedural meanings. Fulfillment describes reality satisfying relevant Conditions; adjudication is the plugin-owned judgment that the fulfillment counts. Participation records the resulting systemic observation.

## Shared language and authority

Activity plugins are authored in Guild Operations language.

They may understand and compose Core-owned concepts such as Guildie, Character, guild Character classification, Role, Spec, rank, authority, time, quantity, and presentation capabilities. The plugin does not need to reconstruct how Core resolves those systemic concepts.

For example, a Raid procedure may require a guild Character. Core owns what qualifies as a guild Character and resolves that classification; Raid owns why that classification matters to Raid procedure.

> **The provider owns what a primitive means and how it is satisfied. The requester owns why its procedure requires it.**

Shared vocabulary therefore does not imply shared motivation or shared authority.

## Declarations and projections

Activity plugins communicate across the Activity boundary in two complementary ways.

**Declarations** report that successful plugin procedure produced a result with systemic Activity significance. Activity does not inspect plugin state and independently decide that the result should have occurred.

**Projections** answer what the occurrence looks like systemically now. They let Activity and Core consumers resolve current Activity-relevant truth without learning the plugin's private domain model or replaying its procedure.

This keeps systemic consumers insulated from concrete plugins. Calendar does not need to know Raid or Raffle. My Participation does not need to understand commitments or claims.

## Rendering and interactions

Core owns Guild Operations rendering and presentation machinery.

An Activity plugin owns what its procedure currently requires or permits. It may expose Activity-relevant interactions and destinations for its own procedural surfaces. Activity translates those meanings into Core representation; the plugin does not render Guild Operations itself.

A plugin may own the destination that fulfills its procedural interaction without owning how Guild Operations presents that interaction.

## Domain ownership

An Activity plugin owns:

- concrete establishment, evolution, adjudication, and conclusion procedure;
- procedural persistence and history;
- plugin-specific meanings such as Raid assignments or Raffle claims;
- the criteria by which its procedural operations succeed;
- which successful procedural acts have systemic Activity significance.

Activity owns:

- stable Activity kind and occurrence identity;
- Active and Record lifecycle meaning;
- Activity plugin registration, availability, activation, and administration boundaries;
- systemic Participation meaning and observations;
- translation of temporal relevance, authority declarations, discovery, interactions, and other Activity-relevant truth into Core capabilities;
- insulation between Activity plugins and systemic consumers.

Core owns the systemic vocabulary and machinery it provides, including identity, authority, Calendar, rendering, administration, and shared infrastructure.

The contract standardizes the **boundary of procedure**, not the expression of procedure.

## Reference procedures

Raid and Raffle are paired pressure tests of Activity.

Raid may express signup commitments, assignment, commitment adjudication, and organizer conclusion. Raffle may express claims, claim adjudication, and drawing. Their different procedures are not exceptions to Activity; they are the reason Activity does not standardize procedure.

Both can nevertheless produce the same systemic meanings where those meanings are genuinely shared: stable Activity occurrences, temporal relevance, Core-rendered representation, authority declarations, and Participation observations.

Common machinery is earned from those shared systemic meanings, not from superficial similarity between the procedures.
