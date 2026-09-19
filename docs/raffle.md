# Raffle

Raffle is a concrete Guild Operations participation module for operating the guild raffle. A Raffle is the activity itself; there is no separate Round object or generic event lifecycle beneath it.

Raffle is deliberately domain-specific. It does not derive its procedure from a generic event, participation, lifecycle, notification, or audit framework.

## Human ceremony

A member says, approximately:

> I intend to buy this many entries through this eligible guild Character, and I promise to deposit the corresponding gold.

That declaration establishes a durable claim. It does not establish drawing participation.

A human attendant verifies the guild-bank deposit. Approval establishes the claim's immutable drawing weight. Denial records that the promise was not accepted. An unresolved claimant may revoke their own declaration before the Raffle concludes.

The operator establishes the Raffle, opens participation, may pause and resume admission before the temporal cutoff, adjudicates claims, and performs the draw. Guild Operations automates the procedure around those human authorities without manufacturing the bank-verification judgment.

## Authority

Blizzard remains authoritative for current Character guild membership, rank, and controlled Characters.

The participating Guildie is authoritative for establishing and revoking their own unresolved claim.

Raffle operators act through explicit global capabilities:

- `raffle.modify` — establish Raffles and modify mutable terms before participation opens;
- `raffle.stage` — open, pause, or resume participation and cancel an unconcluded Raffle;
- `raffle.claims` — inspect and adjudicate claims;
- `raffle.draw` — perform the manual draw.

Consequential authority is enforced by the application operation performing the action. Aggregate capability checks may control presentation, but they grant no mutation authority.

## Application boundary

Raffle application operations are the singular procedural boundary. Web, authenticated HTTP, promoted REST, Discord, and future adapters consume these operations and queries rather than reimplementing Raffle procedure.

Application resource paths and web presentation paths are independent. The promoted machine resource is `/api/v1/raffles/:raffleId`; the durable human record is `/events/raffle/:raffleId`. They meet at the application contract, not at URL conventions.

## Raffle truth

Establishment means the concrete Raffle exists. Availability and conclusion are separate truth.

A newly established Raffle has not yet opened participation. Its terms remain mutable.

An authorized operator may open participation before the one-hour pre-drawing freeze. Once participation has opened, terms are locked so established claims retain the terms under which they were made.

Participation is open only while all of these are true:

- the Raffle is unconcluded;
- participation has been opened;
- operator admission is not currently paused;
- the one-hour pre-drawing freeze has not begun.

Operator pause and temporal closure are deliberately different. A pause is an attributed, reversible admission gate: the operator may resume participation before the cutoff. The one-hour temporal cutoff is derived from time, has no actor, and is irreversible. No operator action may admit new claims after that cutoff.

The declared drawing time is the earliest legitimate draw time. A draw may happen later but never earlier.

Conclusion is recorded separately:

- `drawn` — approved drawing weight existed and a winner was selected;
- `operator_cancelled` — an authorized operator cancelled the Raffle;
- `no_participation` — a legitimate draw found no approved drawing population.

There is no persisted `listed/live/concluded` status enum.

## Modification and cancellation

Terms may be modified only before participation has ever opened. Opening participation permanently locks the Raffle terms, including drawing time, entry price, prize kind, and prize definition. Pausing participation does not make those terms mutable again. This prevents an operator from changing the bargain after members have been given an opportunity to establish claims against it.

Cancellation is deliberately durable. Unlike Raid withdrawal, cancelling a Raffle does not delete the activity or its participation evidence because gold deposits, refunds, and discrepancies may require later human follow-up.

Cancellation preserves claims exactly as they existed. It does not manufacture refund state or rewrite claim resolution.

## Claim

A claim is a durable participant declaration containing:

- its Raffle;
- claimant Guildie;
- controlled guild Character;
- requested entry count;
- promised gold derived from the Raffle's entry price;
- establishment time;
- optional terminal resolution and attribution.

A claim is not evidence that the deposit occurred.

A Guildie may establish multiple claims while participation is open. A claim requesting ten entries remains one claim with requested count ten; Raffle does not persist ten synthetic entry records.

### Resolution

An unresolved claim may become:

- `approved` — attendant and approval time;
- `denied` — attendant, denial time, and required reason;
- `revoked` — claimant and revocation time.

Approval establishes immutable drawing weight. Approved claims cannot be edited or revoked.

Pending claims establish no drawing weight. Denied and revoked claims contribute no drawing weight but remain durable evidence.

Participant revocation remains permitted after admission closes because it retracts already-established intent rather than establishing new intent. It ends when the Raffle concludes.

Organizer adjudication may continue during the one-hour freeze. Every claim must be resolved before drawing.

## Drawing

Entries are ephemeral equal-weight positions derived from approved claims. They are not durable Raffle objects.

The drawing population is reconstructed deterministically from approved claims ordered by claim establishment time and claim ID. Each approved claim contributes its requested entry count.

At or after `drawingAtUnix`, with no unresolved claims:

```text
population > 0
    → uniformly select one position
    → conclusion = drawn

population = 0
    → conclusion = no_participation
```

A drawn Raffle preserves total population size, selected index, winning claim ID, concluding Guildie, and conclusion time. Together with immutable approved claims and deterministic ordering, these facts preserve the authoritative drawing basis.

## Prize model

For a gold Raffle:

```text
pot = approved entry count * entry price
winner share = pot * winner percentage
guild share = pot - winner share
```

For item and other prizes, the prize is descriptive text. Entry price remains WoW gold.

## History and presentation

Raffle history is domain-owned evidence. Claims do not disappear when the Raffle concludes, and cancellation does not withdraw the canonical Raffle record.

Human surfaces are organized for participation and operation:

- `/events/raffle` — standing activity surface;
- `/events/raffle/enter` — establish a claim while participation is open;
- `/events/raffle/claims` — inspect member claims;
- `/events/raffle/:raffleId` — durable public Raffle record;
- `/events/raffle/history` — concluded-Raffle discovery;
- `/events/raffle/rules` — standing rules;
- `/events/raffle/manage` and `/events/raffle/manage/:raffleId` — operational surfaces.

Raffle also registers the enduring Guild Event Offering that makes the activity discoverable even when no Raffle is currently accepting participation. That offering is presentation/discovery metadata, not Raffle lifecycle.

## Calendar boundary

Raffle does not own Calendar publication state.

Raffle owns its authoritative activity truth. Calendar machinery may eventually react to factual application changes, query current Raffle state, and own its own projection. Raffle application operations must not directly synchronize a separate Calendar/event-publication record.

The obsolete direct Raffle publication adapter has therefore been removed.

## Operational inspection

Normal claims, adjudication, conclusions, and drawing evidence belong to Raffle itself rather than the global operational log.

Raffle publishes an operational exception only when it deliberately identifies an abnormal administratively useful condition. The current exception coordinate is `raffle.draw` for the impossible/abnormal case where a successful drawn conclusion lacks the winning-claim coordinate required by the contract.

## Relationship to Raid

Raid and Raffle are useful paired pressure tests, not instances of one generic lifecycle.

Both distinguish participant intent from organizer-established participation and both use the one-hour pre-occurrence participation freeze. Their mechanics remain domain-specific.

Raffle approval establishes immutable drawing weight that the machine can later consume. Raid assignment establishes planned attendance, not actual attendance. Raffle cancellation preserves evidence because financial follow-up may remain; Raid cancellation may withdraw the preparatory activity and its dependent signup/assignment state.

Shared vocabulary should be extracted only where repeated concrete modules have earned it.
