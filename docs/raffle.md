# Raffle

Raffle is a concrete Guild Operations participatory Event module for operating the guild raffle.

It is deliberately modeled as a raffle-specific domain rather than as an instance of a generic event, workflow, participation, notification, or audit framework. In Guild Operations, **Events** is the product category for participatory guild activities. Raffle may also publish system events after authoritative raffle truth changes; those system events are a supporting integration boundary, not the Events product category itself.

## Purpose

The raffle converts a guild member's promissory claim into trusted participation after an authorized human attendant verifies the corresponding World of Warcraft guild-bank deposit.

Guild Operations cannot independently observe sufficient guild-bank history to make that judgment. The attendant remains authoritative for whether the promise was fulfilled. Guild Operations owns the procedure, authorization, persistence, selection, and historical reconstruction around that judgment.

## Authority

Blizzard remains authoritative for:

- current guild membership;
- current guild rank;
- which WoW characters the subject currently controls.

The member is authoritative for:

- initiating a claim;
- selecting the controlled guild character through which the promised deposit is made;
- requested ticket quantity;
- cancelling their own unresolved claim.

A raffle administrator is authoritative for:

- creating and configuring rounds;
- making a claim approval or denial judgment after observing the WoW guild-bank ledger;
- supplying the reason for a denial;
- manually drawing or administratively cancelling a round.

Guild Operations is authoritative for:

- which operations current authority permits;
- the durable claim and round records;
- the deterministic construction of a round's selection population;
- execution and preservation of the manual draw result.

The current guild policy grants raffle administration to ranks 0, 1, and 2 through the explicit `raffle.admin` capability. Raffle code authorizes against the capability rather than interpreting numeric ranks itself.

## Round

A round is the bounded raffle drawing cycle.

Its operating terms are intentionally small:

- round ID;
- drawing deadline as a timezone-neutral instant;
- ticket price in gold;
- prize kind;
- winner percentage when the prize kind is gold.

The configured drawing deadline establishes the raffle's schedule but does not automatically mutate round lifecycle state or initiate a draw. New claim submission closes exactly one hour before the drawing deadline so raffle administrators have a dedicated adjudication window for pending claims. Interfaces express both instants in the viewer's local timezone.

Round terms may be changed while the round is still `created`. Once a round becomes `live`, its terms are fixed so claims preserve the terms under which they were made.

At most one round may be `live` for the guild at a time. A `created` round is administrative preparation, not an active/public raffle.

### Round lifecycle

```text
created
  ├──> live
  │      ├──> drawn
  │      ├──> admin_cancelled
  │      └──> no_entry_cancelled
  └──> admin_cancelled
```

Draws are always manual.

A draw is refused while unresolved claims remain. This prevents a member promise from being silently excluded from a completed raffle. When a draw is requested with no approved entries and no unresolved claims, the round concludes as `no_entry_cancelled` rather than pretending a draw failed.

## Claim

A claim is a durable promissory record.

It means, approximately:

> This guild member, acting through this controlled guild character, intends to deposit the gold corresponding to this many tickets for this round.

A claim is not evidence that the deposit occurred and does not itself establish tickets.

A claim records:

- claim ID;
- round ID;
- subject;
- specific controlled WoW character;
- requested ticket count;
- promised gold value derived from the round's ticket price at submission;
- creation time;
- optional terminal resolution.

A subject may create multiple claims in the same round, including multiple claims using the same character, while claim submission remains open.

Claim admission closes one hour before the drawing deadline. This cutoff prevents new promises from arriving during the final adjudication window while leaving existing unresolved claims available for attendant approval or denial.

Claims are not rewritten to correct their original meaning. An unresolved claimant may cancel their own claim and create another one while claim submission remains open. The original cancelled claim remains historical truth.

### Claim resolution

An unresolved claim may end in exactly one of three ways:

- `approved`: explicit approving attendant and approval time;
- `denied`: explicit denying attendant, denial time, and mandatory reason;
- `cancelled`: explicit claimant and cancellation time.

Approval establishes the claim's raffle participation. Pending claims establish no tickets. A denial and a cancellation contribute no participation but remain durable records.

Administrative cancellation of the parent round does not rewrite an approved claim into a cancelled claim. Approval remains evidence that the attendant confirmed the promised deposit and may therefore matter to later guild refund handling. Refund completion is not currently raffle state and must not be manufactured from cancellation history.

## Selection population

Tickets do not currently need individually durable database objects.

An approved claim contributes its requested ticket count as equal positions in the round's selection population. If Claim A was approved for five tickets and Claim B for two, the conceptual population is:

```text
[A, A, A, A, A, B, B]
```

Every position has exactly one equal chance of selection. There is no member-level weighting model hidden behind the draw.

The population is reconstructed deterministically from approved claims ordered by claim creation time and claim ID. A manual draw uniformly selects one zero-based position from that population.

The completed round preserves:

- total entry count;
- selected index;
- winning claim ID;
- concluding administrator and time.

Those facts are sufficient to reconstruct why the selected position resolves to the winning claim while retaining the entire claim provenance behind the winner.

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

The raffle intentionally derives as much as possible from a small set of authoritative facts. The same state used to operate the raffle therefore preserves the history required to inspect it later.

## Surface boundary

The raffle domain owns raffle meaning. Interfaces own expression of that meaning.

Current participant-facing web surfaces are:

- `/events/raffle` — current participatory raffle surface;
- `/events/raffle/history` — completed and cancelled raffle history;
- `/events/raffle/rules` — standing guild raffle rules and regulations.

Raffle administration is a distinct privileged projection over the same raffle truth:

- `/admin/raffle` — current and preparatory raffle administration work;
- `/admin/raffle/:roundId` — detailed raffle management, claim adjudication, manual draw, and administrative ledger.

The former `/events/raffle/admin/*` paths are compatibility redirects rather than a second canonical administrative hierarchy. Raffle administration remains authorized through the existing `raffle.admin` capability.

The administration root intentionally excludes concluded raffles because terminal rounds no longer represent active officer work. Their durable history remains available through the ordinary raffle history projection.

Raffle is not permanently promoted in primary navigation. A live raffle may be promoted from the home surface; when no raffle is live there is no active raffle to promote.

Discord and other subscribers remain interaction surfaces over the same backend truth. They do not become independent owners of raffle state.

## System-event publication

Raffle publishes system events when meaningful authoritative raffle reality successfully changes. A publication creates attention rather than truth: it carries the occurrence kind and small authority-oriented coordinates so a subscriber can query Guild Operations for current state.

A successful manual draw publishes `raffle.round.drawn` with the winning claim coordinate. A manual draw with no approved entries publishes `raffle.round.no-entry-cancelled`. The draw UI invokes the same authoritative raffle operation and publication path as any other caller; it does not own separate draw truth.

Failed attempts, authorization failures, database failures, transport failures, and other machinery errors are not raffle system events. Publication failure does not undo an authoritative raffle operation that already succeeded.

The concrete references are separated by purpose:

- `docs/publications/raffle.md` — the raffle system events currently published and their coordinates;
- `docs/endpoints/raffle.md` — authoritative raffle HTTP query and operation contracts;
- `docs/publication-model.md` — cross-cutting publication doctrine;
- `docs/integrations/botghost.md` — current BotGhost transport variables and operator reference.

This separation lets Raffle remain the owner of raffle truth while publication and external interaction remain projections over that truth.