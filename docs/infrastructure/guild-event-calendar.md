# Guild Event Calendar

The Guild Event Calendar is shared infrastructure for temporal Guild Event discovery.

Use it when a module-owned concrete occurrence should be discoverable by consumers that understand a common calendar contract rather than the producing module.

## Data flow

```text
Module-owned occurrence truth
        ↓
Guild Event Calendar Listing
        ↓
Guild Event Calendar Registry
        ↓
Calendar consumer
```

The module remains authoritative for its occurrence truth. The Calendar stores and exposes the listing contract.

## Listing contract

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

The producing module determines whether an occurrence is an instant or range and may re-establish the same listing when better temporal truth becomes available.

For example, an estimated future instant may later become an observed instant or range. Calendar persistence represents the producer's best current temporal truth; ceremony-specific history remains with the producer.

## Optional fields

Current optional fields are:

```text
guild_event_title
guild_event_destination
guild_event_category
```

- `guild_event_title` — human-facing title for the concrete occurrence.
- `guild_event_destination` — semantic destination associated with the occurrence. Consumers decide how or whether to express it.
- `guild_event_category` — broader organizational classification for consumers.

A listing remains valid when optional fields are absent.

Consumers must not reconstruct omitted fields using module-specific knowledge. There is no arbitrary metadata bag.

## Producer use

A module may establish, re-establish, or withdraw a listing as its owned truth changes.

The producer decides:

- whether the occurrence belongs on the Calendar;
- the truthful required and optional fields it can supply;
- when updated timing or other listing data should replace earlier values;
- when the listing should be withdrawn from discovery.

Withdrawal means the producer no longer wants the occurrence discoverable through the Calendar. It is not the mechanism for merely becoming past.

## Registry behavior

The registry stores listings conforming to the shared contract. It does not need to understand module storage, module status models, route hierarchy, participation rules, or consumer presentation.

Persistence may retain listings after their immediate temporal relevance without turning the registry into a generic domain-history system.

## Consumer use

Calendar consumers read listing fields and choose presentation appropriate to their medium.

Consumers may specialize visual treatment based on contract data such as `guild_event_kind`, but they must not infer omitted destination, category, timing, eligibility, participation state, or other facts from module knowledge.

The current `/events` projection is one Calendar consumer.

### Temporal relevance

Consumers determine relevance from `guild_event_occurs_at`:

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

## Extending the contract

Add a field only when real producer or consumer pressure demonstrates shared temporal-discovery meaning.

Before adding one, verify:

1. the information is actually about temporal discovery of the concrete occurrence;
2. a Calendar consumer can understand it without knowing the producing module;
3. whether it must be required or can remain optional.

The smallest coherent contract is preferred.
