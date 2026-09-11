# Group Coordinator

## Status

Group Coordinator is shared Guild Operations infrastructure for assembling a group from organizer-authored demand and applicant-authored supply.

It is not a Raid implementation, a Guild Event implementation, or a generic workflow engine. Raid, Key Listing, Fashion Show, and other concrete activity modules may call Group Coordinator when they need the same coordination machinery.

This infrastructure has been earned through repeated pressure from concrete activities. Those activities differ in purpose, presentation, and participation semantics, but they share the same coordination problem strongly enough that rebuilding it inside each module would create duplicate truths and divergent behavior.

The central authority boundary is:

> **The organizer authors demand. The applicant authors supply. Assignment reconciles the two.**

Group Coordinator owns that reusable coordination relationship. The calling module owns what the activity is, why the group exists, and what participation ultimately means.

## Boundary

Conceptually:

```text
Activity module
    │
    ├── activity-specific meaning and state
    │
    └── uses Group Coordinator
            ├── Demand
            │   ├── Applicant eligibility
            │   ├── Opportunities
            │   └── Goals
            ├── Supply
            │   └── Offers
            └── Assignments
```

Examples:

```text
Raid plugin
├── defines raid-specific event context
├── defines raid-specific vocabulary/presets
└── uses Group Coordinator

Key Listing plugin
├── defines key-specific context
└── uses Group Coordinator

Fashion Show plugin
├── defines fashion-show-specific context
└── uses Group Coordinator
```

The Group Coordinator must not need to know what a Raid, Mythic+, key listing, fashion show, or other activity is in order to coordinate a group for it.

Likewise, an activity should not duplicate Group Coordinator state merely because it needs to present or operate that state. The coordinator should remain the singular owner of the coordination facts it creates.

## Relationship to Guild Events

Group Coordinator and Guild Event infrastructure are composable capabilities with different responsibilities.

A module may create a Guild Event and use Group Coordinator for the people being assembled around that event. Group Coordinator itself does not make something a Guild Event, and an activity does not need to become a Group Coordinator consumer merely because it is a Guild Event.

For example:

```text
Raid plugin
├── creates/owns a raid occurrence conforming to Guild Event metadata
└── calls Group Coordinator to assemble its raid group
```

The Guild Event contract describes a temporal occurrence. Group Coordinator describes coordinated group formation. Neither should become the persistence owner of the other's facts.

Calendar, Discord, notifications, and other future consumers remain downstream presentation or interaction surfaces over authoritative state. Group Coordinator should not register coordination truth into a second authoritative listing merely for discovery.

## Coordination stages

Group formation can be understood through ordinary stages:

```text
organize
   ↓
apply  ────────┐
   ↓           │
assign ←───────┘
   ↓
activity proceeds
```

These are coordination stages, not formal lifecycle states.

Application and assignment may proceed concurrently. That overlap is important: as organizers assign existing supply, the current group picture changes. Later applicants can see that picture and decide for themselves whether they want to alter or add to the supply they offer.

The coordinator therefore supports an informational feedback loop without turning organizer demand into applicant constraints.

## Demand

Demand is organizer-authored information describing the group the organizer is trying to assemble.

```text
Demand
├── Applicant eligibility   Who may offer?
├── Opportunities           What group composition is desired?
└── Goals                   What properties should the assembled group achieve?
```

Demand exists to make organizer intent legible to both organizers and applicants.

> **Demand informs supply. It does not constrain supply.**

An eligible applicant may review Opportunities, Goals, current offers, and current Assignments before choosing what to offer. They may respond to unmet demand voluntarily, or ignore it and offer something else.

That distinction is deliberate. Group Coordinator should improve coordination by making the situation understandable, not by silently turning organizer preferences into applicant permissions.

### Applicant eligibility

Applicant eligibility answers exactly one question:

> **Who is allowed to submit an offer?**

It is a meta-level access boundary over supply creation.

Applicant eligibility does not answer:

- what the group currently needs;
- whether an offer fits an Opportunity;
- whether an offer advances a Goal;
- whether the organizer is likely to assign it.

Once an applicant passes this gate, the content of their offer belongs to them.

Concrete activity modules may expose different useful eligibility choices. The Group Coordinator should provide the common mechanism without inventing a speculative rules language. Exact eligibility vocabulary should be introduced only when real consumers need it.

The invariant is:

> **Applicant eligibility is the only organizer-authored gate controlling whether supply may be offered. Once admitted, the applicant authors the supply.**

### Opportunities

Opportunities express desired group composition.

Examples from a WoW combat-oriented consumer might be:

```text
tank × 2
healer × 4
damage × 14
```

A simpler consumer might use:

```text
general × 10
```

or an unbounded general Opportunity where appropriate.

An Opportunity is organizer demand. It is not an application target.

> **Applicants do not apply to Opportunities. They submit offers. Assignment is the operation that places offered supply into the desired composition.**

Submitting a compatible offer does not reserve, consume, or fill an Opportunity.

Opportunity quantity may be bounded or unlimited when the consuming activity permits it. Capacity should follow from the expressed demand rather than being authored as a second independent fact.

The exact Opportunity vocabulary belongs to the consuming activity or a trustworthy domain vocabulary it uses. Group Coordinator should not hard-code Raid-specific shapes merely because Raid is an early consumer.

### Goals

Goals express desired aggregate properties of the assembled group.

Examples from a WoW combat-oriented consumer might include:

```text
lust >= 1
battle_res >= 1
ranged >= 6
```

Nothing is assigned to a Goal. Goals are evaluated over current Assignments and the properties brought by the assigned offers.

Goals are informational during application and consequential during assignment. An applicant may see an unmet Goal and voluntarily offer supply that helps satisfy it. The system must not require them to do so.

At assignment time, the coordinator may calculate how a proposed Assignment affects Goal coverage without making the organizer's judgment for them.

> **Show the consequences. Let the organizer decide.**

Goals are optional. Consumers that do not need aggregate composition evaluation should not inherit unnecessary complexity.

### Presets

Presets are authoring shortcuts for common demand sheets.

A consumer may define a preset that initializes Opportunities and Goals together. For example, a Raid plugin may provide a common raid composition preset; a Key Listing plugin may provide a five-player party preset.

Presets do not define activity kinds, applicant supply, assignment policy, eligibility, or participation. They initialize demand that the organizer may then adjust.

Presets therefore belong at the consumer boundary even if Group Coordinator provides the mechanism used to apply them.

## Supply and offers

Supply is applicant-authored.

An offer states what an eligible applicant is willing to contribute to the group.

> **Offers are presented, not shaped by demand.**

The application surface may show the organizer's demand for context, but it must not hide, disable, or reject otherwise valid supply merely because it is not currently needed.

An offer may still be validated for its own structural coherence or authoritative facts. That is different from validating it against organizer demand.

For example, if a consumer accepts a declared WoW class and specialization, Group Coordinator may rely on the consumer's trustworthy domain geometry to establish that the specialization belongs to the class. That validation says the offer is coherent; it does not say the organizer needs it.

### Offer shape belongs to the consumer

Group Coordinator must not assume every offer is a WoW Character or class/spec combination.

A Raid or Key Listing consumer may expose playable offers. A Fashion Show may need a Character but no specialization. Another activity may only need a participant identity and a general offer.

The consuming module defines the meaningful offer payload. Group Coordinator owns the common supply lifecycle and relationship to assignments.

For WoW-oriented consumers, two useful offer forms have already emerged:

```text
Character-backed offer
└── Character
    ├── class            derived from authoritative Character facts
    ├── specialization   derived according to the consumer's authoritative rules
    ├── role             derived
    └── traits           derived
```

and:

```text
Declared offer
├── class
├── specialization
├── role                 derived
└── traits               derived
```

These are not universal Group Coordinator fields. They are useful payloads supplied by WoW-oriented consumers.

Known identity should remain known. If Guild Operations can resolve an applicant to a Guildie, broader participation eligibility should not erase that relationship. Conversely, infrastructure must not manufacture a Guildie or Character identity when it does not possess that authority.

### Multiple offers

A participant may submit multiple offers when they genuinely represent multiple forms of supply.

For example:

```text
Offer A
└── Protection Paladin

Offer B
└── Fire Mage
```

Neither offer targets an Opportunity. They simply state what the applicant is willing to provide.

There is no need for a separate applicant-pool or remainder-pool entity. Offers are the available supply.

An unassigned offer has no inherent social or operational meaning beyond being unassigned. Group Coordinator must not silently turn it into `backup`, `bench`, `alternate`, or another organizer judgment.

Historical offers should not disappear merely because another offer is assigned. Activity-specific mutual exclusivity may make competing offers temporarily non-actionable, but that should not rewrite the history of what was offered.

## Assignment

Assignment is the reconciliation point between organizer-authored demand and applicant-authored supply.

```text
Demand                         Supply

Opportunities                  Offers
Goals

              \               /
               \             /
                Assignment
                    ↓
              assembled group
```

Before Assignment, an offer has not claimed, reserved, targeted, or filled an Opportunity.

Assignment answers the downstream questions that deliberately do not belong to applicant eligibility or offer creation:

- Can this offer occupy this part of the desired composition?
- Is capacity available?
- What Goals would the Assignment satisfy or advance?
- Does the organizer actually want to make this placement?

The coordinator may calculate fit and consequences. The organizer retains composition judgment unless the consuming activity explicitly establishes an automatic assignment policy.

A useful boundary is:

```text
Applicant eligibility
→ Can this person offer?

Offer coherence
→ Is the submitted supply internally valid?

Assignment fit
→ Can this offer occupy this part of demand?

Goal contribution
→ What does this Assignment do to the assembled whole?
```

Only the first question is applicant eligibility.

### Concurrent application and assignment

Applications do not need to close before assignment begins.

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

This feedback loop is a core value of Group Coordinator. Organizers communicate demand structurally; applicants communicate supply structurally; assignments continuously reveal how those two are being reconciled.

The infrastructure makes coordination legible enough that many adjustments can happen without a separate conversation for every decision.

### Automatic assignment

Automatic assignment, if a consumer needs it, is an assignment policy.

It must operate over the same independent demand and supply facts. It must not reshape what eligible applicants are allowed to offer.

Manual assignment should remain the first implementation pressure test because it exposes the actual reconciliation semantics before automation is introduced.

## Group projection

Assignments allow Group Coordinator to project the current assembled group against demand.

A consumer may present information such as:

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

The exact rendering belongs to the consumer or shared presentation facilities, but the underlying relationship belongs to Group Coordinator.

At the point of assignment, the coordinator may also expose calculated consequences:

```text
If this offer is assigned:
- Damage 12 / 14 → 13 / 14
- Lust 0 / 1 → 1 / 1
- Ranged 5 / 6 → 6 / 6
```

This removes calculation burden without turning Group Coordinator into a roster recommender.

## Participation boundary

Group Coordinator assembles the planned group. It does not universally define what actual participation means.

Assignment establishes the intended group relationship. Reality belongs to the consuming activity.

A Raid may later establish attendance. A Fashion Show may establish that an entrant actually presented. Another activity may establish participation asynchronously. Those thresholds are activity-owned because the evidence differs.

Group Coordinator should provide a clean handoff from assembled plan to activity-specific participation without inventing a universal participation-evidence model.

Someone may offer without being assigned, be assigned and fail to participate, or participate after a legitimate real-world substitution. Consumers should remain able to preserve those distinctions.

## Identity and authority

Group Coordinator operates over Guild Operations identity and authority; it does not replace them.

A Guildie remains a durable actor. A Character, class, specialization, role, or other activity payload may describe offered participation without becoming identity.

The consuming activity is responsible for supplying the identity context and authoritative domain facts required by its offers. Group Coordinator should preserve those references and apply coordination rules without becoming an alternate owner of Blizzard or Guildie truth.

Organizer authority must likewise come from existing Guild Operations capability and activity-authority machinery. Group Coordinator may enforce that only an authorized organizer can author demand or assignments, but it should not manufacture authority simply because it owns the procedure.

## Infrastructure invariants

The implementation should preserve these invariants:

1. Organizer authors demand.
2. Applicant authors supply.
3. Applicant eligibility only determines who may offer.
4. Demand may inform supply but must not constrain it.
5. Offers do not target or consume Opportunities.
6. Assignment is the reconciliation operation between demand and supply.
7. Goals evaluate the assembled group; they do not gate offers.
8. Application and assignment may proceed concurrently.
9. Unassigned supply has no inherent meaning beyond being unassigned.
10. Group Coordinator calculates structural consequences without manufacturing organizer judgment.
11. Activity-specific offer payloads and participation semantics remain activity-owned.
12. Group Coordinator owns coordination truth once a consumer invokes it; consumers should not maintain peer copies of the same coordination facts.
13. Group Coordinator is infrastructure, not an activity module and not a generic workflow engine.

## Implementation pressure test

The first implementation target is Group Coordinator itself.

Raid should be treated as an early consumer and pressure test, not as the owner of this machinery. A Raid plugin can later use Guild Event infrastructure to establish the raid occurrence and Group Coordinator to assemble the raid group.

Key Listing and Fashion Show provide independent evidence that the coordination contract is shared infrastructure rather than Raid-specific code.

The initial implementation should therefore establish the smallest reusable coordinator contract that can support a concrete consumer without speculatively designing every future activity. Shared abstractions inside Group Coordinator should still be earned by the actual demand, supply, and assignment behaviors required by those consumers.
