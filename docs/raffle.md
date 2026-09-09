# Raffle

Raffle is a concrete Guild Operations participation module for operating the guild raffle. The module registers an enduring Guild Event Offering so the shared Events shell can promote Raffle even when no round is currently live or scheduled. Individual raffle rounds may separately contribute temporal occurrences to the shared Guild Event Calendar; the raffle module itself is not contained by Guild Events, the Offering registry, or the calendar.

It is deliberately modeled as a raffle-specific domain rather than as an instance of a generic event, workflow, participation, notification, or audit framework.

## Purpose

The raffle converts a guild member's promissory claim into trusted participation after an authorized human attendant verifies the corresponding World of Warcraft guild-bank deposit.

Guild Operations cannot independently observe sufficient guild-bank history to make that judgment. The attendant remains authoritative for whether the promise was fulfilled. Guild Operations owns the procedure, authorization, persistence, deterministic drawing population, drawing, and historical reconstruction around that judgment.

Auditability is a primary value of the raffle module. Operational truth that has been established must remain stable enough for human operators to resolve discrepancies, refunds, and other real-world follow-up against a non-moving target.

## Authority

Blizzard remains authoritative for:

- current Character guild membership;
- current Character guild rank;
- which WoW Characters a Guildie currently controls.

The Guildie is authoritative for:

- initiating a claim;
- selecting the controlled guild Character through which the promised deposit is made;
- requested entry count;
- cancelling their own unresolved claim.

A raffle administrator is authoritative for:

- configuring and establishing rounds;
- making a claim approval or denial judgment after observing the WoW guild-bank ledger;
- supplying the reason for a denial;
- opening a listed round for participation;
- manually drawing or administratively cancelling a round.

Guild Operations is authoritative for:

- which operations current authority permits;
- the durable claim and round records;
- deterministic construction of the ephemeral drawing population from approved claims;
- enforcement of draw preconditions;
- execution and preservation of the manual draw result.

Raffle owns the `raffle.admin` authorization policy because it governs raffle-specific procedure. The current guild policy grants that module capability to Guildies whose globally derived effective Blizzard rank is 0, 1, or 2. Raffle consumes globally authoritative Guildie, Character-control, roster, and rank facts as inputs; it does not own, duplicate, or reinterpret those facts as raffle state.

Raffle code authorizes against the module-owned `raffle.admin` policy rather than provisioning raffle authority through the global `guild_rank_capabilities` machinery or scattering numeric rank comparisons through the module.

## Round

A round is the bounded raffle drawing cycle.

Its operating terms are intentionally small:

- round ID;
- optional round title for recognition;
- drawing deadline as a timezone-neutral Unix instant;
- entry price in gold;
- prize kind;
- winner percentage when the prize kind is gold;
- prize description when the prize kind is item or other.

The configured drawing deadline establishes the raffle's expected resolution time but does not automatically mutate lifecycle state or initiate a draw. New claim submission closes exactly one hour before that deadline so raffle administrators have a dedicated adjudication window for pending claims. Interfaces derive human-readable times from persisted Unix values and express them in the viewer's local timezone when possible.

### Establishment and lifecycle

Creating a round is an operation, not a durable lifecycle state. Once configuration is confirmed, the round is established as `listed`.

A listed round is already a real guild raffle occurrence:

- it is discoverable as upcoming;
- its terms remain editable;
- it may be administratively cancelled;
- it is not yet open for participation.

When participation opens, the round becomes `live`. Once live, its operating terms are fixed so claims preserve the terms under which they were made. At most one round may be live for the guild at a time.

A round has exactly three lifecycle states:

```text
listed
  ├──> live
  │      └──> concluded
  └─────────> concluded
```

`concluded` means raffle procedure has ended. How it ended is recorded separately as the conclusion.

A concluded round has exactly one conclusion:

- `drawn` — a valid drawing population existed and the manual draw selected a winner;
- `operator_cancelled` — an authorized raffle administrator deliberately terminated the round;
- `no_participation` — normal draw resolution found no approved drawing population to select from.

The distinction is deliberate:

```text
status
    → where is this raffle in its lifecycle?

conclusion
    → how did the raffle end?
```

Drawing, cancellation, and creation are operations. They are not lifecycle states.

### Temporal truth and Guild Event Calendar

Raffle scheduling is operated by humans, not by a deterministic automation system. Scheduled time therefore represents the best established expectation until actual operational boundaries become known.

For a raffle round contributed to the Guild Event Calendar, `guild_event_occurs_at` expresses the best currently established temporal truth of the ceremony and may change as better truth becomes available:

```text
listed
    → [drawing_at_unix]

live
    → [live_at_unix, drawing_at_unix]

concluded after going live
    → [live_at_unix, concluded_at_unix]
```

A scheduled boundary is not considered false merely because it may later move; it is the best available truth while the boundary remains future or estimated. Once the raffle establishes an observed boundary, that observed Unix value supersedes the estimate in the Guild Event Calendar Listing.

Each calendar Listing points at the durable public record for that exact raffle round at `/events/raffle/:roundId`. The destination therefore remains meaningful as the same round moves from an inspectable upcoming preview to a live record and finally to concluded history.

Operator cancellation withdraws the Guild Event Calendar Listing because it revokes the occurrence from calendar discovery before intended resolution. The canonical raffle-round record remains available; withdrawing the calendar listing does not erase the fact that the guild established and operated the round.

## Claim

A claim is a durable promissory record.

It means, approximately:

> This Guildie, acting through this controlled guild Character, intends to deposit the gold corresponding to this many entries for this round.

A claim is not evidence that the deposit occurred and does not itself establish drawing weight.

A claim records:

- claim ID;
- round ID;
- claimant Guildie;
- specific controlled WoW Character;
- requested entry count;
- promised gold value derived from the round's entry price at submission;
- creation Unix time;
- optional terminal resolution.

The persisted relationships are deliberately explicit:

```text
claimant_guildie_id
    → which Guildie owns/authorized the claim

character_record_id
    → which WoW guild Character participates through the claim
```

Neither relationship is represented by a generic Subject coordinate. `Subject` is contextual language only.

A Guildie may create multiple claims in the same round, including multiple claims using the same Character, while claim submission remains open. Each claim remains one durable record regardless of requested count. A claim requesting ten entries is one claim with requested entry count ten, not ten persisted entry records.

Claim admission closes one hour before the drawing deadline. This cutoff prevents new promises from arriving during the final adjudication window while leaving existing unresolved claims available for attendant approval or denial.

Claims are not rewritten to correct their original meaning. An unresolved claimant may cancel their own claim and create another one while claim submission remains open. The original cancelled claim remains historical truth.

### Claim resolution

An unresolved claim may end in exactly one of three ways:

- `approved`: explicit approving Guildie and approval Unix time;
- `denied`: explicit denying Guildie, denial Unix time, and mandatory reason;
- `cancelled`: explicit claimant Guildie and cancellation Unix time.

Approval is the boundary where a claim begins contributing immutable drawing weight. The approved claim's requested entry count becomes the number of equal positions it contributes when the selection population is constructed. Once approved, the claim cannot be cancelled, reduced, edited, or otherwise withdrawn from that population.

Pending claims establish no drawing weight. A denial and a cancellation contribute no drawing weight but remain durable records.

The parent round concluding does not rewrite claim resolution state. In particular, operator cancellation leaves approved, denied, cancelled, and unresolved claims exactly as they existed at the moment of cancellation.

## Drawing population

Entries are not durable raffle objects. They are ephemeral equal-weight positions derived from approved claims for winner selection.

An approved claim contributes its requested entry count as equal positions in the drawing population. If Claim A was approved for five entries and Claim B for two, the conceptual population is:

```text
[A, A, A, A, A, B, B]
```

Every position has exactly one equal chance of selection. There is no member-level weighting model hidden behind the draw.

The population is reconstructed deterministically from approved claims ordered by claim creation time and claim ID. Those individual positions have no independent behavior, authority, lifecycle, persistence record, or historical significance. Outside winner selection, the durable claims already contain the participation truth.

Once a claim is approved, its drawing weight is immutable. Selection positions cannot be withdrawn from the population even though unresolved claims may still be cancelled before resolution.

## Drawing

Draws are always manual.

A draw is refused while any unresolved claims remain. This is a deliberate audit failsafe: every pending promise must first receive operated human attention so the draw cannot silently exclude unresolved real-world activity.

When no unresolved claims remain, the draw derives the authoritative selection population from approved claims:

```text
drawing population > 0
    → uniformly select one zero-based position
    → conclusion = drawn

drawing population = 0
    → conclusion = no_participation
```

`no_participation` is not cancellation. The raffle procedure successfully reached its resolution point and found no approved drawing population to act upon. Claims may have existed, been denied, or been cancelled; those facts are irrelevant to the drawing unless they established approved drawing weight.

A drawn round preserves enough result evidence to reconstruct the selection:

- total drawing population size;
- selected index;
- winning claim ID;
- concluding Guildie administrator;
- conclusion Unix time.

Combined with the immutable approved claims and deterministic population ordering, those facts are sufficient to reconstruct why the selected position resolves to the winning claim. The public round record does not need to expose this selection machinery merely to establish transparency; it exposes the durable claims, final eligible population size, winner, and winnings instead.

## Conclusion and audit preservation

Every conclusion preserves the raffle's pre-conclusion operational state for auditability. Conclusion appends terminal truth; it does not reconcile, normalize, or clean up the evidence that existed immediately beforehand.

For every concluded round, the lifecycle operation establishes at minimum:

```text
status = concluded
conclusion = <drawn | operator_cancelled | no_participation>
concluded_at_unix = <unix>
```

Additional draw-result facts are appended only for `drawn`.

`operator_cancelled` is intentionally different from normal draw resolution. It may conclude a round while unresolved claims still exist. The entire raffle machinery state remains untouched except for the conclusion facts required to establish that the round ended.

Therefore operator cancellation does not:

- resolve pending claims;
- revoke approved claims;
- remove approved drawing weight;
- alter denied or claimant-cancelled claims;
- rewrite round terms;
- manufacture refund state.

The preserved state gives human operators a non-moving target against which they can resolve refunds, discrepancies, and other guild procedures outside the raffle machinery.

This preservation rule also applies to `drawn` and `no_participation`: drawing consumes a deterministic projection of established claim truth but does not mutate the claims or drawing basis it consumed.

## Prize model

Prize kind is declarable raffle state.

For a gold raffle:

```text
pot = approved entry count * entry price
winner share = pot * winner percentage
guild share = pot - winner share
```

Only approved claims contribute to the pot or prize projection.

For item and other raffles, the configured prize is descriptive text rather than a calculated share of the gold pot. Entry price remains denominated in WoW gold regardless of prize kind.

## Historical behavior

Claims do not disappear when a round concludes. They remain ordinary historical records.

Their operational activity is determined by the lifecycle of their round. There is no separate archive flag and no cleanup procedure that rewrites participation history.

Raffle state is evidence, not a convenience model. Once operational truth has been established, later lifecycle actions must not rewrite it merely to make terminal state look tidy.

The raffle intentionally derives as much as possible from a small set of authoritative facts. The same state used to operate the raffle therefore preserves the history required to inspect it later.

## Public round records

Every established raffle round has one durable, read-only public destination:

```text
/events/raffle/:roundId
```

The route follows the same round through its lifecycle rather than creating separate preview, live, and archive objects:

```text
listed
    → inspectable preview

live
    → inspectable current round record

concluded
    → durable public record
```

The record exists for transparency, not interaction. It may link a viewer toward the current participation surface while a round is live, but it does not submit claims, cancel claims, adjudicate claims, edit terms, draw, cancel the round, or perform other raffle operations.

A concluded drawn record exposes the recorded winner, actual winnings, final eligible drawing-population size, and a literal one-row-per-claim ledger. Each claim row presents the participating Character, requested entry count, promised gold, claim time, recorded resolution status, and resolution time where one exists. Denied claims may also present their recorded denial reason.

A normally drawn round cannot contain unresolved claims because draw preconditions prohibit it. An operator-cancelled round may contain unresolved claims, and those unresolved rows remain visible exactly because cancellation is the conclusion most likely to require later refund or discrepancy scrutiny. The record does not infer or manufacture refund completion state that Raffle does not own.

The public record intentionally does not enumerate synthetic entry rows or expose the random-selection implementation merely to appear more detailed. Approved claim counts and requested entry counts are sufficient to reconstruct the eligible population; individual entries are only the transient equal-weight positions used by winner selection.

## Surface boundary

The raffle domain owns raffle meaning. Interfaces own expression of that meaning.

The raffle module exposes the enduring Guild Event Offering:

```text
id          → raffle
title       → Raffle
tagline     → Take your shot at the pot.
destination → /events/raffle
```

That Offering exists independently of raffle-round lifecycle. The Events shell may promote Raffle even when no round is live or scheduled. The Offering does not explain raffle procedure; `/events/raffle` remains the module-owned engagement and participation surface.

Current participant-facing web surfaces are:

- `/events/raffle` — Raffle homepage; when a round is live it optimizes immediate participation and claim access, and otherwise provides a standing engagement surface rather than duplicating the Guild Event Calendar;
- `/events/raffle/:roundId` — durable read-only record for one exact raffle round, from upcoming preview through concluded history;
- `/events/raffle/history` — index of concluded rounds linking to their durable records;
- `/events/raffle/rules` — standing guild raffle rules and regulations.

The resulting presentation rule is:

> Raffle optimizes the present for participation while preserving every round for inspection.

Raffle administration is a distinct privileged projection over the same raffle truth:

- `/admin/raffle` — listed and live raffle administration work;
- `/admin/raffle/:roundId` — detailed raffle management, claim adjudication, manual draw, and administrative ledger.

The former `/events/raffle/admin/*` paths are compatibility redirects rather than a second canonical administrative hierarchy. Raffle administration remains authorized through the module-owned `raffle.admin` capability.

The administration root intentionally excludes concluded raffles because terminal rounds no longer represent active officer work. Their durable records remain available through the ordinary public raffle history projection.

Raffle is not permanently promoted in primary navigation. A live raffle may additionally be promoted from the home surface; that home promotion is lifecycle-sensitive and separate from the enduring Guild Event Offering.

Discord and other integrations remain interaction surfaces over the same backend truth. They do not become independent owners of raffle state.
