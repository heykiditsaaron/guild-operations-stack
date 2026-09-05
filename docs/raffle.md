# Raffle

Raffle is a concrete Guild Operations participation module for operating the guild raffle. Individual raffle rounds may be listed as Guild Events through the shared Guild Event contract while they remain relevant to participation awareness; the raffle module itself is not contained by Guild Events.

It is deliberately modeled as a raffle-specific domain rather than as an instance of a generic event, workflow, participation, notification, or audit framework. Raffle may publish system events after authoritative raffle truth changes; those system events are a supporting integration boundary, not the Guild Event product category itself.

## Purpose

The raffle converts a guild member's promissory claim into trusted participation after an authorized human attendant verifies the corresponding World of Warcraft guild-bank deposit.

Guild Operations cannot independently observe sufficient guild-bank history to make that judgment. The attendant remains authoritative for whether the promise was fulfilled. Guild Operations owns the procedure, authorization, persistence, deterministic ticket population, drawing, and historical reconstruction around that judgment.

Auditability is a primary value of the raffle module. Operational truth that has been established must remain stable enough for human operators to resolve discrepancies, refunds, and other real-world follow-up against a non-moving target.

## Authority

Blizzard remains authoritative for:

- current Character guild membership;
- current Character guild rank;
- which WoW Characters a Guildie currently controls.

The Guildie is authoritative for:

- initiating a claim;
- selecting the controlled guild Character through which the promised deposit is made;
- requested ticket quantity;
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
- the deterministic construction of a round's ticket population;
- enforcement of draw preconditions;
- execution and preservation of the manual draw result.

Raffle owns the `raffle.admin` authorization policy because it governs raffle-specific procedure. The current guild policy grants that module capability to Guildies whose globally derived effective Blizzard rank is 0, 1, or 2. Raffle consumes globally authoritative Guildie, Character-control, roster, and rank facts as inputs; it does not own, duplicate, or reinterpret those facts as raffle state.

Raffle code authorizes against `raffle.admin` rather than scattering numeric rank comparisons through the module. The current implementation still provisions `raffle.admin` through the global `guild_rank_capabilities` machinery. That provisioning path is conformity debt against the module-ownership boundary and should be corrected when raffle administration is next revised; it does not make `raffle.admin` a globally owned permission.

## Round

A round is the bounded raffle drawing cycle.

Its operating terms are intentionally small:

- round ID;
- drawing deadline as a timezone-neutral Unix instant;
- ticket price in gold;
- prize kind;
- winner percentage when the prize kind is gold.

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

- `drawn` — a valid ticket population existed and the manual draw selected a winner;
- `operator_cancelled` — an authorized raffle administrator deliberately terminated the round;
- `no_participation` — normal draw resolution found no ticket population to select from.

The distinction is deliberate:

```text
status
    → where is this raffle in its lifecycle?

conclusion
    → how did the raffle end?
```

Drawing, cancellation, and creation are operations. They are not lifecycle states.

### Guild Event Listing eligibility and temporal truth

Guild Event Listings exist for participation awareness, not raffle history.

A raffle round is eligible for a Guild Event Listing only while shared discovery can still direct a member toward a meaningful participation avenue.

For Raffle, that means:

```text
listed
    → eligible
    → guild_event_occurs_at = [drawing_at_unix]

live
    → eligible
    → guild_event_occurs_at = [live_at_unix, drawing_at_unix]

concluded
    → not eligible
    → withdraw Guild Event Listing
```

A listed round cancelled before going live is likewise no longer listing-eligible because no participation avenue remains. It is withdrawn from Guild Event discovery even though it remains a historically real raffle round inside the Raffle module.

Raffle scheduling is operated by humans, not by a deterministic automation system. While a round remains listing-eligible, scheduled time represents the best established expectation until actual operational boundaries become known.

A scheduled boundary is not considered false merely because it may later move; it is the best available truth while the boundary remains future or estimated. When the raffle establishes an observed opening boundary, that observed Unix value may replace the corresponding estimated boundary in the current Guild Event Listing.

Once the raffle concludes, Guild Event Listing responsibility ends. Raffle owns the actual conclusion time, result, audit evidence, and historical presentation. The Guild Event Registry must not be used as a second raffle-history system.

## Claim

A claim is a durable promissory record.

It means, approximately:

> This Guildie, acting through this controlled guild Character, intends to deposit the gold corresponding to this many tickets for this round.

A claim is not evidence that the deposit occurred and does not itself establish tickets.

A claim records:

- claim ID;
- round ID;
- claimant Guildie;
- specific controlled WoW Character;
- requested ticket count;
- promised gold value derived from the round's ticket price at submission;
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

A Guildie may create multiple claims in the same round, including multiple claims using the same Character, while claim submission remains open.

Claim admission closes one hour before the drawing deadline. This cutoff prevents new promises from arriving during the final adjudication window while leaving existing unresolved claims available for attendant approval or denial.

Claims are not rewritten to correct their original meaning. An unresolved claimant may cancel their own claim and create another one while claim submission remains open. The original cancelled claim remains historical truth.

### Claim resolution

An unresolved claim may end in exactly one of three ways:

- `approved`: explicit approving Guildie and approval Unix time;
- `denied`: explicit denying Guildie, denial Unix time, and mandatory reason;
- `cancelled`: explicit claimant Guildie and cancellation Unix time.

Approval is the boundary where a claim begins contributing immutable drawing weight. Approval establishes the claim's requested ticket count as valid raffle tickets. Once approved, the claim cannot be cancelled, reduced, edited, or otherwise withdrawn from the raffle population.

Pending claims establish no tickets. A denial and a cancellation contribute no tickets but remain durable records.

The parent round concluding does not rewrite claim resolution state. In particular, operator cancellation leaves approved, denied, cancelled, and unresolved claims exactly as they existed at the moment of cancellation.

## Ticket population

Tickets are derived drawing units established by approved claims. They are not independently persisted raffle objects.

An approved claim contributes its requested ticket count as equal positions in the round's ticket population. If Claim A was approved for five tickets and Claim B for two, the conceptual population is:

```text
[A, A, A, A, A, B, B]
```

Every position has exactly one equal chance of selection. There is no member-level weighting model hidden behind the draw.

The population is reconstructed deterministically from approved claims ordered by claim creation time and claim ID. The individual ticket positions have no independent behavior or authority before the draw, so persisting separate ticket records would duplicate the approved-claim truth without adding meaning.

Once a claim is approved, its ticket weight is immutable. Tickets cannot be withdrawn from the raffle population even though unresolved claims may still be cancelled before resolution.

## Drawing

Draws are always manual.

A draw is refused while any unresolved claims remain. This is a deliberate audit failsafe: every pending promise must first receive operated human attention so the draw cannot silently exclude unresolved real-world activity.

When no unresolved claims remain, the draw derives the authoritative ticket population from approved claims:

```text
ticket population > 0
    → uniformly select one zero-based position
    → conclusion = drawn

 ticket population = 0
    → conclusion = no_participation
```

`no_participation` is not cancellation. The raffle procedure successfully reached its resolution point and found no ticket population to act upon. Claims may have existed, been denied, or been cancelled; those facts are irrelevant to the drawing unless they established approved ticket weight.

A drawn round preserves enough result evidence to reconstruct the selection:

- total ticket population size;
- selected index;
- winning claim ID;
- concluding Guildie administrator;
- conclusion Unix time.

Combined with the immutable approved claims and deterministic population ordering, those facts are sufficient to reconstruct why the selected position resolves to the winning claim.

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
- remove approved ticket weight;
- alter denied or claimant-cancelled claims;
- rewrite round terms;
- manufacture refund state.

The preserved state gives human operators a non-moving target against which they can resolve refunds, discrepancies, and other guild procedures outside the raffle machinery.

This preservation rule also applies to `drawn` and `no_participation`: drawing consumes a deterministic projection of established claim truth but does not mutate the claims or ticket basis it consumed.

## Prize model

Prize kind is declarable raffle state. Gold is the first implemented prize kind, not the conceptual limit of the module.

For a gold raffle:

```text
pot = approved ticket count * ticket price
winner share = pot * winner percentage
guild share = pot - winner share
```

Only approved claims contribute to the pot or prize projection.

## Historical behavior

Claims do not disappear when a round concludes. They remain ordinary historical records.

Their operational activity is determined by the lifecycle of their round. There is no separate archive flag and no cleanup procedure that rewrites participation history.

Raffle state is evidence, not a convenience model. Once operational truth has been established, later lifecycle actions must not rewrite it merely to make terminal state look tidy.

The raffle intentionally derives as much as possible from a small set of authoritative facts. The same state used to operate the raffle therefore preserves the history required to inspect it later.

Guild Event Listing withdrawal does not alter this historical responsibility. A concluded or never-live cancelled round disappears from shared participation discovery because it no longer offers a participation avenue, while Raffle continues to preserve the round and its audit history.

## Surface boundary

The raffle domain owns raffle meaning. Interfaces own expression of that meaning.

Current participant-facing web surfaces are:

- `/events/raffle` — current participatory raffle surface;
- `/events/raffle/history` — concluded raffle history;
- `/events/raffle/rules` — standing guild raffle rules and regulations.

Raffle administration is a distinct privileged projection over the same raffle truth:

- `/admin/raffle` — listed and live raffle administration work;
- `/admin/raffle/:roundId` — detailed raffle management, claim adjudication, manual draw, and administrative ledger.

The former `/events/raffle/admin/*` paths are compatibility redirects rather than a second canonical administrative hierarchy. Raffle administration remains authorized through the module-owned `raffle.admin` capability.

The administration root intentionally excludes concluded raffles because terminal rounds no longer represent active officer work. Their durable history remains available through the ordinary raffle history projection.

Raffle is not permanently promoted in primary navigation. A live raffle may be promoted from the home surface; when no raffle is live there is no active raffle to promote.

Discord and other subscribers remain interaction surfaces over the same backend truth. They do not become independent owners of raffle state.

## System-event publication

Raffle publishes system events when meaningful authoritative raffle reality successfully changes. A publication creates attention rather than truth: it carries the occurrence kind and small authority-oriented coordinates so a subscriber can query Guild Operations for current state.

The publication vocabulary must follow raffle truth rather than preserve obsolete lifecycle terminology. A successful manual draw may publish a draw conclusion event with the winning claim coordinate. A normal draw resolution with no ticket population may publish a `no_participation` conclusion event. Operator cancellation may publish its own conclusion event when an external interaction surface needs attention.

Exact system-event names are an integration contract and should be reconciled with this doctrine during implementation alignment rather than inferred from the obsolete `drawn`, `admin_cancelled`, or `no_entry_cancelled` lifecycle states.

Failed attempts, authorization failures, database failures, transport failures, and other machinery errors are not raffle system events. Publication failure does not undo an authoritative raffle operation that already succeeded.

The concrete references are separated by purpose:

- `docs/publications/raffle.md` — the raffle system events currently published and their coordinates;
- `docs/endpoints/raffle.md` — authoritative raffle HTTP query and operation contracts;
- `docs/publication-model.md` — cross-cutting publication doctrine;
- `docs/integrations/botghost.md` — current BotGhost transport variables and operator reference.

This separation lets Raffle remain the owner of raffle truth while publication and external interaction remain projections over that truth.
