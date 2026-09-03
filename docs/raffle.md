# Raffle

The raffle is the first concrete Guild Operations participation capability.

It is deliberately modeled as a raffle-specific domain rather than as an instance of a generic event, workflow, participation, notification, or audit framework.

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
- approximate drawing time as a Unix timestamp;
- ticket price in gold;
- prize kind;
- winner percentage when the prize kind is gold.

The configured drawing time is guideline metadata only. It does not automatically close claims, freeze participation, or initiate a draw.

Round terms may be changed while the round is still `created`. Once a round becomes `live`, its terms are fixed so claims preserve the terms under which they were made.

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

A claim records:

- claim ID;
- round ID;
- subject;
- specific controlled WoW character;
- requested ticket count;
- promised gold value derived from the round's ticket price at submission;
- creation time;
- optional terminal resolution.

A subject may create multiple claims in the same round, including multiple claims using the same character.

Claims are not rewritten to correct their original meaning. An unresolved claimant may cancel their own claim and create another one. The original cancelled claim remains historical truth.

### Claim resolution

An unresolved claim may end in exactly one of three ways:

- `approved`: explicit approving attendant and approval time;
- `denied`: explicit denying attendant, denial time, and mandatory reason;
- `cancelled`: explicit claimant and cancellation time.

Approval and ticket birth are one transactional consequence. There is no intermediate state in which an approval has been committed but its participation has not. If the transaction fails, the claim remains unresolved.

A denial and a cancellation contribute no participation but remain durable records.

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

## Historical behavior

Claims do not disappear when a round concludes. They remain ordinary historical records.

Their operational activity is determined by the lifecycle of their round. There is no separate archive flag and no cleanup procedure that rewrites participation history.

The raffle intentionally derives as much as possible from a small set of authoritative facts. The same state used to operate the raffle therefore preserves the history required to inspect it later.

## Surface boundary

The raffle domain does not own platform-specific presentation.

The native web application, Discord interactions, and later webhook publication are surfaces over the same backend operations and state. Discord association resolves an interaction to the existing Guild Operations subject; it does not create alternate raffle ownership or truth.

Rendered views and publishable webhook representations should be designed later around the stable raffle operations. They must not become separate owners of raffle state.
