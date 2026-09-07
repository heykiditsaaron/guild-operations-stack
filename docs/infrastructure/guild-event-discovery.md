# Guild Event Discovery

Guild Event discovery is shared infrastructure through which concrete capabilities contribute two different kinds of discovery information:

```text
Guild Event Offering
    → What participation does the guild offer?

Guild Event Calendar Listing
    → What concrete occurrence happens when?
```

These are independent contracts. A capability may expose an enduring Offering without a scheduled occurrence, and may establish Calendar Listings only for concrete occurrences with temporal meaning.

## Guild Event Offerings

Use an Offering when the Events shell should be able to promote an enduring participation capability even when no concrete occurrence is scheduled.

### Contract

```ts
type GuildEventOfferingArtwork =
  | { kind: "asset"; asset: string }
  | { kind: "url"; url: string };

type GuildEventOffering = {
  offeringId: string;
  title: string;
  tagline: string;
  destination: string;
  artwork?: GuildEventOfferingArtwork;
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
src/guild-events/offerings/
```

Registration is application composition rather than persisted guild truth.

The producer owns the semantic values it registers. The Events shell owns arrangement and presentation. Registration order is not presentation policy.

Modules must not register HTML, CSS, arbitrary metadata, shell layout instructions, rules, eligibility, administration, history, scheduling, or procedure through the Offering contract.

Do not use Offerings as a generic module capability registry. Internal operations and administrative actions are not enduring participation offerings merely because they exist.

## Guild Event Calendar Listings

Use a Calendar Listing when a module-owned concrete occurrence should be discoverable by consumers that understand a common temporal contract rather than the producing module.

### Data flow

```text
Module-owned occurrence truth
        ↓
Guild Event Calendar Listing
        ↓
Guild Event Calendar Registry
        ↓
Calendar consumer
```

The producer remains authoritative for the occurrence truth. The Calendar stores and exposes the listing contract.

### Listing contract

Every listing requires:

```text
guild_event_id
guild_event_kind
guild_event_occurs_at
```

- `guild_event_id` — globally unique identifier for the concrete Guild Event occurrence.
- `guild_event_kind` — concrete ceremony/event kind represented by the occurrence.
- `guild_event_occurs_at` — current best temporal truth supplied by the producer.

Time uses Unix values:

```text
[unix]
    → instant

[unix, unix]
    → range from start to end
```

The producing capability determines whether the occurrence is an instant or range and may re-establish the same listing when better temporal truth becomes available. Calendar persistence represents the producer's best current temporal truth; ceremony-specific history remains with the producer.

Current optional fields are:

```text
guild_event_title
guild_event_destination
guild_event_category
```

- `guild_event_title` — human-facing title for the concrete occurrence.
- `guild_event_destination` — semantic destination associated with the occurrence; consumers choose how or whether to express it.
- `guild_event_category` — broader organizational classification for consumers.

A listing remains valid when optional fields are absent. Consumers must not reconstruct omitted fields using module-specific knowledge. There is no arbitrary metadata bag.

### Producer operations

A producer may establish, re-establish, or withdraw a listing as its owned truth changes.

The producer decides:

- whether the occurrence belongs on the Calendar;
- which truthful required and optional fields it can supply;
- when updated timing or other listing data replaces earlier values;
- when the listing should be withdrawn from discovery.

Withdrawal means the producer no longer wants the occurrence discoverable through the Calendar. It is not the mechanism for merely becoming past.

### Registry behavior

The registry stores listings conforming to the shared contract. It does not need to understand module storage, status models, route hierarchy, participation rules, or consumer presentation.

Persistence may retain listings after their immediate temporal relevance without turning the registry into a generic domain-history system.

### Consumer behavior

Calendar consumers read listing fields and choose presentation appropriate to their medium.

Consumers may specialize visual treatment based on contract data such as `guild_event_kind`, but they must not infer omitted destination, category, timing, eligibility, participation state, or other facts from module knowledge.

The current `/events` projection is one Calendar consumer.

Temporal relevance is derived from `guild_event_occurs_at`:

```text
instant [T]
    current/future while T >= now
    past once T < now

range [start, end]
    upcoming while now < start
    happening while start <= now <= end
    past once end < now
```

The registry does not remove a listing merely because time passed.

## Relationship between the contracts

An Offering may exist with zero Calendar Listings. A Calendar Listing may describe an occurrence related to an Offering, but neither contract establishes the other's truth.

The Events shell may consume both contracts because it presents both enduring discovery and temporal discovery. That shared consumer does not collapse the contracts into one event model.

## Extending discovery infrastructure

Add a contract field only when real producer or consumer pressure demonstrates shared discovery meaning.

For Calendar fields, verify that the information is genuinely about temporal discovery and can be understood without knowledge of the producing capability.

For Offering fields, verify that the information is genuinely about enduring participation discovery rather than module procedure or shell layout.

Prefer the smallest coherent contracts required by real use.
