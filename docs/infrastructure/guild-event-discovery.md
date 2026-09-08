# Guild Event Discovery

Guild Event discovery is shared infrastructure with two independent contracts:

```text
Guild Event Offering
    → What participation does the guild offer?

Guild Calendar Event
    → What concrete guild occurrence happens when?
```

A capability may expose an enduring Offering without any scheduled occurrence. A guild occurrence may also be placed on the Calendar without belonging to an internal module.

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

## Guild Calendar Events

The Guild Calendar is the authoritative shared registry of guild occurrences that have intentionally been placed on the calendar. It owns temporal registration and the current shared calendar representation. It is not a generic event-management system.

A module-owned occurrence may exist without a Calendar event. For example, a raffle round may be created before raffle decides that the round should be projected into shared temporal discovery. Until the module establishes a Calendar event, the Calendar has no representation of that round.

An authorized external application operation may also create a Calendar event directly. Such an event does not need a fake module or producer identity.

### Data flow

```text
Module-owned occurrence truth ──┐
                               ├──→ Guild Calendar Event ──→ Calendar consumers
External calendar operation ───┘
```

When a module contributes an occurrence, the module remains authoritative for its procedure and lifecycle. The Calendar stores only the shared temporal representation the module has intentionally established.

### Contract

```ts
type GuildCalendarOccursAt =
  | readonly [number]
  | readonly [number, number];

type GuildCalendarEvent = {
  eventId: string;
  title: string;
  occursAt: GuildCalendarOccursAt;
  category: string | null;
  destination: string | null;
};
```

- `eventId` — globally unique coordinate for the Calendar event.
- `title` — required human-facing name of the occurrence.
- `occursAt` — current best temporal truth for the occurrence.
- `category` — optional broad classification meaningful to Calendar consumers without knowledge of the producing capability.
- `destination` — optional semantic destination associated with the occurrence; consumers choose how or whether to express it.

Time uses Unix values:

```text
[unix]
    → instant

[unix, unix]
    → range from start to end
```

There is no arbitrary metadata bag. Module identity, producer identity, procedure status, eligibility, participation rules, and module-specific lifecycle do not belong in the shared Calendar contract merely because a producer knows them.

`kind` is intentionally not part of the contract. Concrete module/event type is not currently needed to understand or operate shared temporal discovery. `category` remains optional because a broad member-facing classification may be useful across producers.

### Registration and withdrawal

Presence in the Calendar is the act of registration.

```text
occurrence exists elsewhere
    → not necessarily on Calendar

establish Calendar event
    → registered and discoverable

withdraw Calendar event
    → no longer discoverable
```

Persistence may retain a withdrawn row as operational state, but `discoverable` is not a producer-facing contract field. Consumers see currently registered Calendar events rather than a second visible state meaning “registered but not registered.”

Establishing the same `eventId` again replaces its current Calendar representation. This supports module projections whose best temporal truth can change without making the Calendar responsible for ceremony-specific history.

Withdrawal means the event should no longer be represented through the Calendar. Withdrawal is not the mechanism for merely becoming past.

### Temporal state

Consumers derive temporal relevance from `occursAt`:

```text
instant [T]
    current/future while T >= now
    past once T < now

range [start, end]
    upcoming while now < start
    happening while start <= now <= end
    past once end < now
```

The Calendar does not require producers to publish lifecycle statuses such as upcoming, live, concluded, or cancelled. Those meanings belong to event owners when they exist.

The Calendar does not remove an event merely because time passed. A past registered occurrence and a withdrawn occurrence are distinct states.

### History

The Calendar is not a generic history ledger. It stores the current shared representation of a registered occurrence. Module-specific scheduling history remains with the owning module. Application operations may be recorded through global operational inspection where appropriate.

### Consumers

Calendar consumers read the same shared contract and choose presentation appropriate to their medium. They must not reconstruct omitted category, destination, participation state, eligibility, or other facts from module-specific knowledge.

The current `/events` projection is one Calendar consumer. Versioned REST is another adapter over the same application contract.

## Relationship between the contracts

An Offering may exist with zero Calendar events. A Calendar event may describe an occurrence related to an Offering, but neither contract establishes the other's truth.

The Events shell may consume both because it presents both enduring participation discovery and temporal discovery. That shared consumer does not collapse the contracts into one event model.

## Extending discovery infrastructure

Add a contract field only when real producer or consumer pressure demonstrates shared discovery meaning.

For Calendar fields, verify that the information is genuinely about temporal discovery and can be understood without knowledge of the producing capability.

For Offering fields, verify that the information is genuinely about enduring participation discovery rather than module procedure or shell layout.

Prefer the smallest coherent contracts required by real use.
