# Guild Event Calendar

The Guild Event Calendar is shared infrastructure for temporal Guild Event discovery.

Participation modules own their procedures and the truth those procedures establish. When a concrete module-owned occurrence should appear on the guild calendar, the module translates the temporal truth it owns into a Guild Event Calendar Listing. Calendar consumers read that listing rather than learning the module that produced it.

The relationship is:

```text
Module
    owns participation truth and procedure
        ↓ translates temporal occurrence truth into
Guild Event Calendar Listing
    conforms to the Calendar Listing Contract
        ↓ established in
Guild Event Calendar Registry
        ↓ read by
Calendar Consumer
    understands listings, not modules
```

The calendar is infrastructure, not the owner of Guild Events generally. A Guild Event may have informational, administrative, historical, or participatory surfaces that do not belong to the calendar at all.

## Calendar Listing Contract

Every Guild Event Calendar Listing requires:

```text
guild_event_id
guild_event_kind
guild_event_occurs_at
```

These are the irreducible calendar coordinates of a listing:

- `guild_event_id` identifies the concrete Guild Event occurrence and must be globally unique among Guild Events in Guild Operations.
- `guild_event_kind` names the concrete ceremony type represented by the calendar occurrence. It does not necessarily name the module that owns the procedure.
- `guild_event_occurs_at` expresses when the owning module says the concrete Guild Event occurs.

`guild_event_occurs_at` follows the repository-wide Unix time persistence rule:

```text
[unix]
    → instant

[unix, unix]
    → range from start to end
```

The owning module determines the truthful temporal shape for each concrete occurrence. The calendar does not derive temporal meaning from module state.

### Best-known temporal truth

`guild_event_occurs_at` is mutable operational truth, not an immutable copy of the first schedule ever established.

Guild-operated ceremonies may depend on human scheduling and best-attempt adherence rather than deterministic automation. A scheduled or estimated boundary is therefore authoritative while it is the best truth the owning module has established. When the module later establishes an observed boundary, it may re-establish the same Calendar Listing with the more accurate Unix value.

Conceptually:

```text
future or not-yet-observed boundary
    → scheduled / estimated Unix

observed boundary becomes available
    → actual Unix supersedes the estimate
```

This is not historical rewriting. A Calendar Listing is a projection of the module's best currently established temporal truth. Ceremony-specific history remains owned by the module, while the calendar exposes the current temporal truth its consumers should use.

The same Guild Event kind may therefore legitimately change temporal shape or values over its lifecycle. For example, a raffle round may be listed initially as an expected drawing instant, become a live range from actual opening time through expected drawing time, and after conclusion expose the actual live-to-conclusion range.

A valid listing may contain only the required coordinates. Such a listing may be less expressive to a particular calendar consumer, but it remains a complete Guild Event Calendar Listing.

## Optional contract fields

Additional listing fields may be optional, but optional does not mean informal or module-defined.

> Every field in a Guild Event Calendar Listing, required or optional, has semantics defined by the Calendar Listing Contract.

The current optional fields are:

```text
guild_event_title
guild_event_destination
guild_event_category
```

`guild_event_title` supplies a human-facing title for the concrete calendar occurrence. A consumer may use the supplied title when present. When it is absent, a consumer may still express `guild_event_kind` according to its own presentation conventions; doing so presents an existing listing coordinate rather than reconstructing a missing title fact.

`guild_event_destination` supplies the destination associated with the concrete Guild Event occurrence. It is not an HTML `href` or a required presentation mechanism. A web calendar consumer may make a listing clickable, a Discord calendar consumer may express the destination differently, and another consumer may ignore it.

A listing without `guild_event_destination` remains valid and is simply informative to a consumer that would otherwise use the destination. The consumer must not reconstruct a destination from the event kind or from knowledge of the owning module.

`guild_event_category` supplies a broader organizational classification for calendar consumers. It does not establish that the Guild Event exists and is not required merely because a particular projection can display or organize by category.

The absence of any optional field is meaningful and complete:

> Calendar consumers may use optional listing fields when present and ignore them when absent. They must not recover missing listing fields through module-specific knowledge.

There is no arbitrary metadata bag. A new optional field belongs in the calendar contract only after real module or calendar-consumer pressure demonstrates a shared temporal-discovery meaning that consumers can understand without knowing which module produced the listing.

## Module boundary

Modules own participation truth and procedure. They decide whether one of their concrete occurrences belongs on the Guild Event Calendar and establish the listing coordinates they can truthfully provide.

A module may establish, re-establish, or withdraw a Guild Event Calendar Listing as its owned truth changes. The calendar registry does not interrogate the module to derive those changes.

Re-establishing a listing with more accurate occurrence time is expected behavior when a module replaces scheduled or estimated boundaries with observed ones. The module remains responsible for deciding when that newer temporal truth exists.

Contributing to the Guild Event Calendar does not transfer ownership of the module's procedure, participation truth, ceremony-specific historical meaning, informational surfaces, or administrative surfaces to calendar infrastructure.

Modules translate their temporal truth into calendar listings; calendar consumers do not translate module truth themselves.

## Registry boundary

The Guild Event Calendar Registry is the common container of Calendar Listings established by modules.

It understands the Calendar Listing Contract. It does not need to understand:

- raffle or another concrete module;
- module storage or status models;
- member-facing route hierarchy;
- consumer presentation;
- how a module derived the listing it established;
- non-calendar Guild Event knowledge or capabilities.

The registry exists so calendar consumers can read one common collection of temporal Guild Event listings instead of interrogating modules independently.

Persistence may preserve listings after their immediate calendar relevance has passed, but that does not make the registry a generic history system or require it to understand ceremony-specific history.

Withdrawal means that a module says the occurrence should no longer be discoverable through the calendar. It is not the mechanism by which an occurrence merely becomes past. Temporal relevance remains consumer-owned.

## Calendar consumer boundary

> Calendar consumers understand Guild Event Calendar Listings, not modules.

A calendar consumer reads contract-defined listing fields and decides which listings are relevant to its purpose and how to express them in its medium.

Consumers may specialize presentation based on listing information, including `guild_event_kind`, but they must not use kind as a backdoor for reconstructing absent facts. A consumer may choose a visual treatment for a known kind; it may not infer an omitted destination, category, timing, participation state, eligibility rule, or other listing coordinate from module-specific knowledge.

The listing establishes shared calendar facts. The consumer chooses presentation.

This permits multiple output presentations over the same calendar infrastructure. A web page, Discord integration, future WoW surface, or another calendar consumer may organize and render the same established temporal truth differently without becoming an owner of it.

The current `/events` calendar projection is one consumer. Its current purpose is prospective participation discovery: it uses listing time to determine which occurrences are happening or upcoming and may use other supplied coordinates to enrich their presentation. The broader `/events` page is not itself the calendar; it may also host non-calendar Guild Event orientation and promotion supplied through other infrastructure.

### Temporal relevance

Calendar consumers determine temporal relevance from the listing's occurrence time:

```text
instant [T]
    current/future while T >= now
    past once T < now

range [start, end]
    upcoming while now < start
    happening while start <= now <= end
    past once end < now
```

The registry does not withdraw a listing merely because time has passed. A consumer chooses whether past listings are relevant to its surface.

## Contract growth

The calendar contract should grow from concrete projection and module pressure rather than from an imagined generic event schema.

When a calendar consumer needs information that the current listing cannot provide, ask:

1. Is this information actually about temporal discovery of the concrete occurrence?
2. Can any calendar consumer understand the proposed field correctly without knowing which module produced the listing?
3. Does the field need to be present for every valid Calendar Listing, or can its absence simply reduce what consumers can express?

Only shared calendar meaning belongs in the Calendar Listing Contract. Required fields should remain the smallest set necessary for a coherent temporal listing; additional expressive capability should be earned as contract-defined optional fields.

In short:

> Modules translate temporal Guild Event truth into Guild Event Calendar Listings. The Calendar Listing Contract defines their shared temporal language. The Guild Event Calendar Registry contains those listings. Calendar consumers understand listings, not modules.
