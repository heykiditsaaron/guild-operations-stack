# Activity Discovery

Activity discovery is shared presentation infrastructure with two independent contracts:

```text
Activity Offering
    → What participation does the guild offer?

Guild Calendar Point
    → What concrete guild occurrence happens when?
```

A capability may expose an enduring Offering without any concrete Guild Activity currently existing. Calendar points represent temporal state for authoritative subjects; Calendar itself is Core and is not a Guild Activity Module.

## Activity Offerings

Use an Offering when the Events shell should be able to promote an enduring participation capability even when no concrete occurrence is scheduled.

### Contract

```ts
type GuildActivityOfferingArtwork =
  | { kind: "asset"; asset: string }
  | { kind: "url"; url: string };

type GuildActivityOffering = {
  offeringId: string;
  title: string;
  tagline: string;
  destination: string;
  artwork?: GuildActivityOfferingArtwork;
};
```

- `offeringId` — stable identifier for the enduring Offering contribution; unique among registered Offerings.
- `title` — member-facing activity name.
- `tagline` — short promotional copy suitable for discovery, not rules or procedure.
- `destination` — member-facing destination where the owning capability explains and operates participation.
- `artwork` — optional recognition artwork using either an application asset or external image URL.

Artwork carries no layout instructions. Consumers own sizing, cropping, positioning, fallback, and presentation.

### Registration

Offerings are registered under:

```text
src/guild-activities/offerings/
```

Registration is application composition rather than persisted guild truth.

The producer owns the semantic values it registers. The Events shell owns arrangement and presentation. Registration order is not presentation policy.

Modules must not register HTML, CSS, arbitrary metadata, shell layout instructions, rules, eligibility, administration, history, scheduling, or procedure through the Offering contract.

Do not use Offerings as a generic module capability registry. Internal operations and administrative actions are not enduring participation offerings merely because they exist.

## Guild Calendar Points

The Guild Calendar is a temporal map. It persists that an authoritative application subject occupies a temporal coordinate and records where that subject's authority can be queried when a consumer chooses to project the point.

### Contract

```ts
type GuildCalendarOccursAt =
  | readonly [number]
  | readonly [number, number];

type GuildCalendarPoint = {
  sourceKind: string;
  sourceSubject: string;
  occursAt: GuildCalendarOccursAt;
};
```

`sourceKind` identifies the owning application authority, such as `raid` or `raffle`. `sourceSubject` identifies the concrete authoritative subject within that authority. Together they identify the Calendar point and tell a consumer where to query for projection guidance.

`occursAt` is either an instant or a start/end range. It is the Calendar-owned temporal fact.

Calendar persistence does not copy titles, categories, destinations, participation state, lifecycle state, descriptions, results, or other module facts. The owning module's application query remains authoritative for those values. Projection metadata supplied by that query means: if a consumer chooses to project that aspect, use this authoritative value. The consumer still decides which values to show and how to present them.

### Emission-driven reconciliation

Modules do not publish Calendar-shaped objects. They publish semantic emissions into application-wide emission transport. Calendar is one consumer of that transport and explicitly registers interest in the top-level activity emissions that can establish, move, reconcile, or withdraw temporal points.

The current Calendar-producing emissions are operationally published durably in the same database transaction as their authoritative operation or observed transition, then delivered to Calendar after that transaction commits. Calendar does not own emission production or transport, and it is not privileged over other consumers. Future Discord, Push, or other consumers may independently subscribe to the same emissions and perform entirely different work after receipt. Domain-defined temporal production may also enter the same transport without making Calendar responsible for scheduling or producing those occurrences.

Current lifecycle handling is:

- establishment queries the authoritative subject and establishes/reconciles its point;
- modification re-queries and reconciles the point;
- Raffle conclusion re-queries/reconciles and does not withdraw the point;
- cancellation withdraws the point;
- time passing alone does not withdraw a point.

Current Calendar interests are subject-level Raid and Raffle emissions. Parent/subject emissions such as Raid signups and Raffle claims do not currently establish or move Calendar points. This is a current earned boundary, not a permanent prohibition on subordinate temporal subjects.

### Temporal state and retention

Consumers derive temporal relevance from `occursAt`. Upcoming, happening, and historical are presentation/temporal derivations rather than persisted Calendar lifecycle.

The Calendar does not remove a point merely because time passed. A past occurrence and a withdrawn occurrence are distinct. Eventual cleanup of old points is Calendar-owned retention policy and does not manufacture source-domain withdrawal.

### Calendar-native scheduling

Calendar does not currently own a generic event-insertion ceremony or external mutation API.

Calendar is nevertheless a Core capability, not merely a projection over Module-owned activities. When concrete product pressure earns it, Calendar may own simple scheduled occurrences or messages whose authoritative meaning is scheduling itself and which require no richer participation domain.

That future capability must not turn Calendar into a generic Guild Activity engine. If an occurrence develops its own lifecycle, participation procedure, adjudication, or other substantial guild-owned domain truth, that pressure indicates a Module rather than additional Calendar metadata.

### Consumers

A Calendar presentation begins with the persisted temporal point, then queries its owning authority for current projection guidance. This allows the same point set to support an agenda, grid, history view, compact widget, Discord expression, or another surface without changing Calendar truth.

## Relationship between the contracts

An Offering may exist with zero Calendar points. A Calendar point may describe an occurrence related to an Offering, but neither contract establishes the other's truth.

The Events shell may consume both because it presents both enduring participation discovery and temporal discovery. That shared consumer does not collapse the contracts into one activity model.

## Extending discovery infrastructure

Add a contract field only when real producer or consumer pressure demonstrates shared discovery meaning.

For Calendar fields, verify that the information is genuinely about temporal discovery and can be understood without knowledge of the producing capability.

For Offering fields, verify that the information is genuinely about enduring participation discovery rather than module procedure or shell layout.

Prefer the smallest coherent contracts required by real use.
