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

Participation exists only in relation to a Guild Activity. A Guild Activity is not required to expose participation, but anything Guild Operations describes as participation belongs to a concrete Guild Activity.

When an active Guild Activity exposes participation, its current participation availability may be described as:

- **open** — eligible participants may currently establish new participation intent;
- **closed** — new participation intent may not currently be established.

Open and closed are participation adjectives of an active Activity, not lifecycle states. Closed participation does not conclude the Activity and may be reversible when the domain permits it. Once the Activity concludes, current participation availability no longer applies.

### Intent and authority

Eligible participants are authoritative for declaring their own willful intent to participate. Declaring intent does not by itself prove that participation occurred or, where the domain distinguishes them, that an organizer established the participant's procedural place in the Activity.

Organizer authority is distinct from participant authority. A domain may allow organizers to accept or disallow declared intent, establish expected participation, modify an established arrangement, or withdraw it. Similar consequences across Activities do not imply a generic approval workflow.

Where the domain permits, a participant may revoke their own durable declaration. Revocation preserves the historical fact that the declaration existed while ending its ongoing procedural effect. The domain owns when revocation remains legitimate.

Application operations should describe their semantic effect rather than their persistence verb. **Establish** means authoritative truth begins to exist; **modify** changes existing truth while retaining continuity; **revoke** is a participant retracting their own declaration where permitted; **withdraw** ends concrete authoritative truth. Domains retain more specific language where their actual mechanics differ.

### Participation evidence

Software preserves only the strongest participation fact it can legitimately establish.

Intent is not proof of occurrence. Organizer establishment of expected participation is not proof of actual attendance. A domain may mechanically possess stronger evidence where its procedure actually creates it.

Each Activity domain owns what participation evidence remains historically significant and how it survives conclusion. Different retention behavior is legitimate when the underlying human procedure has different consequences.

### Participation protection

A domain owns temporal and operational rules protecting its participation ceremony. Ordinary modification must not invalidate authoritative procedural truth already established under an Activity's terms or manufacture participation that could not legitimately occur under those terms.

Shared policy should become Guild Activity doctrine only when the semantic rule is genuinely universal to Guild Activity participation. Similar current rules in multiple concrete domains remain domain policy until that stronger claim is earned.

## Attribution

Meaningful authoritative Activity mutations should preserve sufficient nearby attribution to recover, where meaningful:

- the subject whose truth changed;
- the actor who made the declaration or decision;
- the authority under which that actor acted;
- the resulting authoritative truth;
- when it happened; and
- the reason, when reason is part of the ceremony.

Subject and actor remain distinct even when the same person commonly occupies both roles. This does not require a universal audit framework; attribution stays with the domain truth or history that gives it meaning.

## Domain ownership

Guild Activity governance standardizes semantic meaning, not implementation. Each concrete domain owns:

- establishment and modification procedure;
- authoritative temporal facts and their representation;
- the rules determining whether the Activity is active or concluded;
- any participation procedure, authority, availability, protection, and evidence;
- conclusion kinds and consequences;
- persistence and historical evidence;
- application operations and authority.

Do not introduce a generic Guild Activity table, superclass, lifecycle engine, registry, shared status column, participation framework, approval workflow, or mandatory application interface merely to encode this vocabulary.

## Semantic events and emissions

A Guild Activity domain owns which meaningful system events are significant enough to publish as semantic emissions. Authoritative state change and communicative significance are separate concerns.

This doctrine does not require establishment, modification, conclusion, cancellation, participation changes, or any other occurrence to be emitted. A domain may also contain authoritative working state whose intermediate mutations are truthful without each mutation constituting a meaningful announcement.

When a domain publishes an event, it follows the application-wide semantic emission contract defined by [Architecture](architecture.md). A domain may, for example, publish establishment as `raid.established` or `raffle.established`. Standardizing emission syntax and transport does not standardize emission obligation.

Guild Activity emissions may be produced directly by meaningful authoritative operations or by domain-defined temporal thresholds. For example, a Raid may eventually define a meaningful pre-occurrence threshold without making Calendar, scheduling machinery, or another consumer authoritative for that Raid meaning.

Consumers independently decide which published events matter to them. A consumer reacting to an Activity's emissions does not acquire lifecycle authority over the Activity, and a consumer cannot require the domain to publish an event merely because that event would be useful to it. After receipt, each consumer owns its own consequential work; transport does not encode Calendar, Discord, Push, audience, or other consumer-specific behavior.

Where a concrete human ceremony contains an explicit communication boundary, the owning domain should preserve that boundary rather than infer communication from every mutation. Such boundaries remain domain-specific until repeated pressure earns something broader.

## Consumers and projections

Guild Activities may be queried or projected by shared infrastructure and presentation machinery. Those consumers are not Guild Activities merely because they operate on Activity truth.

Calendar is the current example. Calendar is presentation/projection machinery over temporal truth. It may consume selected Activity emissions and retain its own temporal points, but it does not represent, establish, operate, or own a Guild Activity.

Likewise, the public `/events` surface is a human-facing projection and discovery surface. **Event** is the public term for Guild Activities there; it is not an internal superclass.

## Reference domains

Raid and Raffle are paired pressure tests of this doctrine. They share the Guild Activity semantic family while retaining different domain mechanics.

Raid derives natural conclusion from occurrence time and may destructively cancel a pre-occurrence Activity. Raffle persists explicit conclusion facts and preserves cancellation because consequential participation evidence may require later reconciliation.

Their current participation timing, mutability, assignment, adjudication, communication, and retention rules belong to those concrete domains unless a genuinely universal Guild Activity semantic is established.

Those differences are evidence of domain ownership, not exceptions to Guild Activity governance.
