# Guild Activity

A **Guild Activity** is a guild-owned, lifecycle-bound temporal occurrence. Raid and Raffle are the first concrete Guild Activity modules.

This doctrine defines the semantic family. It does not define a generic implementation, persistence model, lifecycle engine, registry, or superclass. Every Guild Activity module also follows [Module Conformity](module-conformity.md).

## Activity and event

Internally, **activity** names the authoritative lifecycle-bound subject. **Event** names a meaningful system occurrence concerning authoritative state.

Human-facing adapters may present Guild Activities as **Events** where that is the natural member vocabulary. Public presentation language does not redefine the internal domain concept.

A Guild Activity is something the guild actually enacts. Its temporal coordinates are constitutive: without a concrete location or extent in time, there is no activated Guild Activity, only a recipe, definition, offering, template, configuration, or other description from which an activity may be established.

The concrete domain owns the authoritative representation of that temporal meaning. One activity may use an occurrence instant or range; another may use a drawing time, deadline, or another domain-specific temporal fact.

## Lifecycle

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

**Establishment is an operation and system event, not a lifecycle state.** It brings a previously nonexistent Guild Activity into the active state.

**Active** means the activity's activation continues.

**Concluded** means that activation has ended.

Conclusion is semantic rather than a required persisted transition. A domain may derive conclusion from time, preserve explicit conclusion facts, or use another legitimate domain rule. Cancellation, completion, drawing, expiration, or other terminal meanings are domain-defined ways an activity may conclude; they are not additional universal lifecycle states.

The domain owns whether and how a concluded activity survives as durable history. Conclusion therefore does not imply retention, and withdrawal or destructive cancellation does not create a second universal lifecycle.

## Optional participation

Participation is optional and subordinate to Guild Activity lifecycle.

When an active Guild Activity exposes participation, its current participation availability may be described as:

- **open** — new participation may currently be established;
- **closed** — new participation may not currently be established.

Open and closed are participation adjectives of an active activity, not peer lifecycle states. Closed participation does not conclude the activity and may be reversible when the domain permits it. Once the activity is concluded, current participation availability no longer applies.

The detailed semantics of participant intent, organizer authority, revocation, establishment of participation, evidence, and operational protection are governed by [Participation Semantics](participation-semantics.md).

A Guild Activity without signup, registration, entry, or other participation machinery remains a legitimate Guild Activity.

## Domain ownership

Guild Activity governance standardizes semantic meaning, not implementation. Each concrete domain owns:

- establishment and modification procedure;
- authoritative temporal facts and their representation;
- the rules that determine whether the activity is active or concluded;
- any participation procedure and its open/closed rules;
- conclusion kinds and consequences;
- persistence and historical evidence;
- application operations and authority.

Do not introduce a generic Guild Activity table, superclass, lifecycle engine, registry, shared status column, or mandatory application interface merely to encode this vocabulary.

## Semantic events and emissions

A Guild Activity domain owns which meaningful system events are significant enough to publish as semantic emissions. This doctrine does not require establishment, modification, conclusion, cancellation, participation changes, or any other occurrence to be emitted.

When a domain does publish an event, it follows the application-wide semantic emission code shape. A domain may, for example, publish establishment as `raid.established` or `raffle.established`. Standardizing emission syntax does not standardize emission obligation.

Consumers independently decide which published events matter to them. A consumer reacting to an activity's emissions does not acquire lifecycle authority over the activity, and the consumer cannot require the domain to publish an event merely because that event would be useful to it.

## Consumers and projections

Guild Activities may be queried or projected by shared infrastructure and presentation machinery. Those consumers are not Guild Activities merely because they operate on Activity truth.

Calendar is the current example. Calendar is presentation/projection machinery over temporal truth. It may consume selected Activity emissions and retain its own temporal points, but it does not represent, establish, operate, or own a Guild Activity.

Likewise, the public `/events` surface is a human-facing projection and discovery surface. **Event** is the public term for Guild Activities there; it is not an internal superclass.

## Reference domains

Raid and Raffle are paired pressure tests of this doctrine. They share the Guild Activity semantic family while retaining different domain mechanics.

Raid derives natural conclusion from occurrence time and may destructively cancel a pre-occurrence activity. Raffle persists explicit conclusion facts and preserves cancellation because consequential participation evidence may require later reconciliation.

Those differences are evidence of domain ownership, not exceptions to Guild Activity governance.
