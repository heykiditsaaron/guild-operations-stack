# Participation Semantics

Guild Operations exists to mechanically encode human guild participation without replacing the people who are authoritative for that participation.

This doctrine records the semantic distinctions earned by comparing concrete participation modules. It is vocabulary and design constraint, not a generic participation framework, lifecycle engine, persistence model, or event superclass.

## Activity existence and availability

A participation activity is **established** when its concrete authoritative domain truth exists.

Whether that activity currently accepts new participation intent is a separate fact:

- **open** — eligible participants may establish new participation intent;
- **closed** — new participation intent may not be established.

Open and closed describe what is true, not how it became true. Operator action, temporal policy, or another domain rule may establish the same resulting availability state.

An established activity may therefore be closed before it opens, open for participation, or closed again while it remains operational. A domain may also have a reversible admission gate that temporarily prevents new intent without establishing irreversible closure.

An activity is **concluded** when it is no longer operationally available but remains historical truth about an activity that existed or occurred.

An activity is **withdrawn** when its authoritative concrete domain truth ceases to exist. Whether withdrawal is legitimate and what dependent state survives are domain questions.

Conclusion and withdrawal are not interchangeable. Historical retention follows consequential domain truth, not a generic requirement to preserve every preparation record.

## Participation intent and authority

Eligible participants are authoritative for declaring their own willful intent to participate.

Establishing that intent does not by itself establish that participation occurred or that an organizer has accepted it.

Where the domain permits, the participant may **revoke** their declaration. Revocation preserves the historical fact that the declaration existed while ending its ongoing procedural effect. Revocation is not an unconditional right; each activity determines when it remains permissible.

Organizers are authoritative for the activity decisions entrusted to them. Depending on the domain, that can include allowing or disallowing declared intent, establishing expected participation, modifying an established participation arrangement, or withdrawing such an arrangement.

First-party participant authority and organizer authority must remain distinguishable even when their actions contribute to the same eventual participation.

## Establishment, modification, and withdrawal

Application operations should describe what Guild Operations mechanically does to authoritative domain truth.

- **establish** — concrete authoritative truth begins to exist;
- **modify** — existing authoritative truth changes while retaining continuity;
- **revoke** — a first-party participant retracts their own durable declaration where domain rules permit;
- **withdraw** — concrete authoritative truth ceases to exist.

Persistence verbs such as insert, update, and delete do not define application meaning.

Equivalent or near-identical machine procedures across domains should use coherent machine vocabulary. Domain-specific procedures should retain domain-specific language when their mechanics genuinely differ.

## Participation establishment

Declared intent and established participation are distinct facts when the human ceremony distinguishes them.

Raffle demonstrates intent through a claim. Organizer approval establishes drawing weight.

Raid demonstrates intent through a signup. Organizer assignment establishes expected roster participation.

Those organizer procedures have a similar semantic consequence without being the same domain mechanic. They should not be collapsed into a generic approval workflow.

Likewise, absence of organizer establishment is not automatically denial. Where a domain distinguishes an explicit disallowance from leaving intent available for later consideration, the machinery must preserve that distinction.

## Time and the pre-occurrence freeze

Raid and Raffle currently share a Guild Operations participation policy: new participation intent freezes one hour before the declared occurrence.

The freeze is policy, not per-activity configuration. Operators work within it rather than redefining it for individual activities.

The freeze creates protected time for both participants and operators to evaluate settled participation state before the activity can occur. Domain-specific adjudication, revocation, assignment, or other legitimate work may continue during that interval where the owning domain permits it; the shared policy specifically prevents new participation intent.

A domain may prevent new intent earlier through its own operator procedure. In Raffle, that procedure is a reversible participation pause rather than lifecycle closure: an operator may pause and resume admission before the cutoff. No operator action may override the temporal freeze to admit new intent after the cutoff.

A declared occurrence is also a lower temporal bound on occurrence or resolution. Human or domain conditions may cause execution later, but ordinary operation must not make it happen earlier.

For Raffle specifically, drawing before the declared drawing time is forbidden even if all claims have already been resolved. This prevents an operator from shortening the established opportunity after observing its participant population. Drawing becomes permissible only after the declared drawing time and after the Raffle's other draw invariants are satisfied.

## Modification and established temporal truth

Ordinary modification must not invalidate authoritative procedural truth already established under an activity's terms. Raffle makes this concrete by permanently locking all Raffle terms once participation has ever opened; an operator pause does not restore term mutability.

An operator cannot use occurrence modification to short-circuit the participation freeze, reopen a freeze that has already taken effect, or permit an outcome that could not legitimately occur under the established terms.

When an activity's established ceremony can no longer legitimately be modified into the desired shape, its domain-specific withdrawal or cancellation procedure is the appropriate boundary.

## Attribution

Meaningful authoritative mutations should preserve sufficient nearby attribution to recover, where meaningful:

- the subject whose truth changed;
- the actor who made the declaration or decision;
- the authority under which that actor acted;
- the resulting authoritative truth;
- when it happened; and
- the reason, when reason is part of the ceremony.

Subject and actor are distinct concepts even when the same person commonly occupies both roles.

This does not require a universal audit framework. Attribution should remain with the domain truth or domain history that gives it meaning.

## Historical evidence

Software must preserve only the strongest participation fact it can legitimately establish.

A signup can establish intent. An assignment can establish expected participation. Neither proves actual Raid attendance.

Raffle can mechanically know which approved drawing weight entered a draw. Raid requires a future authority-bearing observation before Guild Operations can claim actual attendance.

Each domain owns what remains historically significant. Raffle cancellation remains durable when participation may have created financial or reconciliation consequences. A pre-occurrence Raid withdrawal may remove the Raid and its preparatory signups and assignments because those facts carried no participation cost and existed only to prepare for an activity that will no longer happen.

## Application boundaries

A meaningful concrete domain subject should be investigable through its owning application boundary without requiring consumers to understand persistence.

Web, REST, Discord, future WoW integrations, and shared projections invoke or query those application meanings. They must not independently reconstruct module procedure.

Successful application operations that change no authoritative truth are distinct from mutations that establish a new fact. Derived temporal changes, such as a participation cutoff or occurrence passing, are also distinct from authored mutations.

These distinctions must remain explicit before shared change-emission or projection machinery is designed around them.
