# Raffle

Raffle is a concrete Guild Operations participation module for operating the guild raffle. It registers an enduring Guild Event Offering so the Events surface can promote the activity even when no round is live or scheduled. Concrete rounds separately expose temporal and destination facts to current shared event discovery.

Raffle is deliberately modeled as a raffle-specific domain rather than as an instance of a generic event, workflow, participation, lifecycle, notification, or audit framework.

## Purpose

The raffle converts a Guildie's promissory claim into trusted participation after an authorized human attendant verifies the corresponding World of Warcraft guild-bank deposit.

Guild Operations cannot independently observe sufficient guild-bank history to make that judgment. The attendant remains authoritative for whether the promise was fulfilled. Guild Operations owns the procedure, authorization, persistence, deterministic drawing population, drawing, and historical reconstruction around that judgment.

Auditability is a primary value. Operational truth that has been established remains stable enough for human operators to resolve discrepancies, refunds, and other real-world follow-up against a non-moving target.

## Authority

Blizzard remains authoritative for current Character guild membership, current Character guild rank, and which WoW Characters a Guildie controls.

The participating Guildie is authoritative for initiating a claim, selecting the controlled guild Character through which the promised deposit is made, choosing the requested entry count, and cancelling their own unresolved claim.

Human Raffle operators remain authoritative for the judgments and procedures assigned to their capabilities. Raffle contributes these capability definitions to the global Guild Operations permission system:

- `raffle.modify` — create rounds and change mutable persisted round definition;
- `raffle.stage` — activate or administratively cancel rounds;
- `raffle.claims` — inspect and adjudicate submitted claims;
- `raffle.draw` — perform the manual draw.

Guild Master rank 0 and the configured environment operator override are inherently permitted by global capability machinery. Additional rank grants are configured through global Permissions. Raffle does not own a separate `raffle.admin` super-capability and possession of one Raffle capability does not imply possession of another.

Consequential authority is enforced by the Raffle application operation that performs the action. Aggregate capability checks may be used to decide whether an operational surface should be presented, but they are not mutation authority.

Guild Operations is authoritative for the durable claim and round records, capability evaluation, deterministic construction of the ephemeral drawing population from approved claims, enforcement of draw preconditions, and execution and preservation of the manual draw result.

## Application boundary

Raffle's application operations are the authoritative procedural boundary for transports and interfaces. HTTP routes, web pages, REST adapters, Discord, and future integrations must consume established Raffle operations and query facts rather than independently implementing Raffle procedure.

Current privileged application operations enforce their exact capability. Participant-owned claim submission and self-cancellation instead enforce Raffle participation rules and ownership in the domain.

The versioned `/api/v1/raffle` adapter is intentionally read-only. A machine credential does not manufacture a Guildie actor, claim ownership, or the human authority required for Raffle judgments.

## Round

A round is the bounded raffle drawing cycle. Its operating terms are intentionally small: round ID, optional title, drawing deadline as a Unix instant, entry price in gold, prize kind, winner percentage for a gold prize, and descriptive prize text for item or other prizes.

The drawing deadline establishes the expected resolution time but does not automatically mutate lifecycle state or initiate a draw. New claim submission closes exactly one hour before that deadline so operators have a dedicated adjudication window. Interfaces derive human-readable time from persisted Unix values.

### Lifecycle

Creating a round is an operation, not a durable lifecycle state. Once configuration is confirmed, the round is established as `listed`.

A listed round is a real guild raffle occurrence. It is discoverable as upcoming, its terms remain editable, it may be cancelled, and it is not yet open for participation.

When participation opens, the round becomes `live`. Once live, its operating terms are fixed so claims preserve the terms under which they were made. At most one round may be live for the guild at a time.

```text
listed
  ├──> live
  │      └──> concluded
  └─────────> concluded
```

`concluded` means Raffle procedure has ended. How it ended is recorded separately:

- `drawn` — a valid drawing population existed and the manual draw selected a winner;
- `operator_cancelled` — an authorized operator deliberately terminated the round;
- `no_participation` — normal draw resolution found no approved drawing population.

Status answers where the raffle is in its lifecycle. Conclusion answers how it ended. Creation, drawing, and cancellation are operations, not lifecycle states.

### Temporal truth and current event discovery

Raffle scheduling is operated by humans. Scheduled time represents the best established expectation until observed operational boundaries become known.

The Raffle-owned temporal projection currently expresses:

```text
listed
    → [drawing_at_unix]

live
    → [live_at_unix, drawing_at_unix]

concluded after going live
    → [live_at_unix, concluded_at_unix]
```

The current `calendar-listing.ts` integration is a compatibility projection from Raffle truth into the shared event-publication registry. It is not Raffle lifecycle ownership and it is not the future Calendar architecture. Raffle establishes its round facts and destinations; the adapter translates those facts for current discovery.

Operator cancellation withdraws the current event publication because the intended occurrence is no longer discoverable. The canonical Raffle round remains durable. Publication withdrawal never means deletion or reversal of Raffle truth.

## Concrete round destinations

Raffle owns where one concrete round can be viewed, participated in, and operated. Shared discovery may project these destinations but does not invent them.

The durable public destination is `/events/raffle/:roundId`. While a round is live, the participation destination is `/events/raffle/enter`. The concrete operational destination for a non-concluded round is `/events/raffle/manage/:roundId`.

Destination presence describes a meaningful interaction surface; it does not grant authority to use that surface. A listed round therefore exposes its public and operational meanings, a live round additionally exposes participation, and a concluded round retains only its durable public meaning.

Current Events presentation uses the first destination as its primary interaction. Raffle therefore leads a live publication toward participation and a non-live publication toward its public record. This ordering is Raffle presentation metadata, not Calendar procedure.

## Claim

A claim is a durable promissory record. It means approximately:

> This Guildie, acting through this controlled guild Character, intends to deposit the gold corresponding to this many entries for this round.

A claim is not evidence that the deposit occurred and does not itself establish drawing weight.

A claim records its round, claimant Guildie, specific controlled WoW Character, requested entry count, promised gold derived from the round's entry price, creation time, and optional terminal resolution.

The claimant Guildie and participating Character remain explicit relationships. Neither is replaced by a generic Subject coordinate.

A Guildie may create multiple claims in the same round, including through the same Character, while claim submission remains open. A claim requesting ten entries is one durable claim with requested entry count ten, not ten persisted entry records.

Claim admission closes one hour before the drawing deadline. An unresolved claimant may cancel their own claim and create another while submission remains open. The original cancelled claim remains historical truth.

### Claim resolution

An unresolved claim may end in exactly one of three ways:

- `approved` — approving Guildie and approval Unix time;
- `denied` — denying Guildie, denial Unix time, and mandatory reason;
- `cancelled` — claimant Guildie and cancellation Unix time.

Approval is the boundary where a claim begins contributing immutable drawing weight. Once approved, the requested entry count cannot be cancelled, reduced, edited, or withdrawn from the population.

Pending claims establish no drawing weight. Denied and cancelled claims contribute no drawing weight but remain durable records.

The parent round concluding does not rewrite claim resolution state. Operator cancellation leaves approved, denied, cancelled, and unresolved claims exactly as they existed at cancellation.

## Drawing population and draw

Entries are ephemeral equal-weight positions derived from approved claims for winner selection. They are not durable Raffle objects.

An approved claim contributes its requested entry count as equal positions. The population is reconstructed deterministically from approved claims ordered by claim creation time and claim ID.

Draws are always manual and are refused while any unresolved claims remain. Every pending promise must first receive human attention so a draw cannot silently exclude unresolved real-world activity.

When no unresolved claims remain:

```text
drawing population > 0
    → uniformly select one zero-based position
    → conclusion = drawn

drawing population = 0
    → conclusion = no_participation
```

`no_participation` is normal resolution, not cancellation.

A drawn round preserves total drawing population size, selected index, winning claim ID, concluding Guildie, and conclusion time. Combined with immutable approved claims and deterministic population ordering, these facts reconstruct the selection.

## Cancellation and audit preservation

Raffle cancellation is deliberately durable. It is not modeled after Raid cancellation.

`operator_cancelled` concludes the Raffle round and preserves its evidence. It may occur while unresolved claims exist. Cancellation does not resolve pending claims, revoke approved claims, remove drawing weight, alter denied or claimant-cancelled claims, rewrite terms, or manufacture refund state.

This preservation gives human operators a stable record against which refunds, discrepancies, and other guild procedures can be resolved outside Raffle machinery.

The same preservation principle applies to normal draw resolution: drawing consumes a deterministic projection of established claim truth but does not mutate the claims that established it.

## Prize model

For a gold raffle:

```text
pot = approved entry count * entry price
winner share = pot * winner percentage
guild share = pot - winner share
```

Only approved claims contribute to the pot or prize projection.

For item and other raffles, the configured prize is descriptive text. Entry price remains denominated in WoW gold regardless of prize kind.

## Historical and public behavior

Claims do not disappear when a round concludes. There is no archive flag or cleanup procedure that rewrites participation history. Raffle state is evidence, not a convenience model.

Every established round has one durable read-only public record at `/events/raffle/:roundId`. The same route follows the round through listed preview, live inspection, and concluded history.

A concluded drawn record exposes the winner, actual winnings, final eligible population size, and one row per durable claim. Operator-cancelled rounds may visibly retain unresolved claims because that evidence is specifically useful for later follow-up. The public record does not infer refund completion or other state Raffle does not own.

The record does not enumerate synthetic entry rows or expose random-selection implementation merely to appear more detailed. Approved claims and their requested entry counts already preserve the authoritative drawing basis.

## Surface boundary

Raffle's surfaces have distinct roles over the same backend truth.

Participation/public surfaces include `/events/raffle` as the standing Raffle activity surface, `/events/raffle/enter` for live claim submission, `/events/raffle/claims` for a member's claims, `/events/raffle/:roundId` for a concrete durable round record, `/events/raffle/history` for concluded-round discovery, and `/events/raffle/rules` for standing rules.

Operational surfaces live under `/events/raffle/manage` and `/events/raffle/manage/:roundId`. They project the exact capabilities available to the current operator: modify, stage, claim adjudication, and draw. Operations are not Administration merely because they are privileged.

Administration owns module enablement/configuration and delegated capability policy through the global Administration and Permissions surfaces. Raffle does not maintain a parallel administration hierarchy for ordinary round operation.

The enduring Guild Event Offering remains separate from concrete round lifecycle:

```text
id          → raffle
title       → Raffle
tagline     → Take your shot at the pot.
destination → /events/raffle
```

That Offering answers whether Raffle is an activity the guild offers. A concrete round publication answers when a particular raffle occurrence exists. Neither owns Raffle procedure.

Discord and other integrations remain interaction surfaces over the same backend truth. They do not become independent owners of Raffle state.

## Relationship to Raid

Raid and Raffle now demonstrate a coherent module architecture: each module owns its domain truth, application operations, explicit capabilities, authority enforcement, concrete destinations, and presentation facts while shared surfaces project those facts.

They do **not** establish a shared lifecycle or participation framework. Raid is occurrence-driven and may treat cancellation as removal; Raffle has explicit listed/live/concluded state, a claim-admission window, human adjudication, manual resolution, and durable cancellation evidence. Those differences are domain truth, not architectural debt.

Two modules are enough to establish useful vocabulary and pressure-test boundaries. They are not, by themselves, justification for extracting generic event, participation, lifecycle, destination, or audit machinery beyond the shared contracts already earned.
