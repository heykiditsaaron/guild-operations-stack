# Guild Event Listings

Guild Event Listings are the shared language through which participation modules make concrete, currently actionable guild ceremonies visible to consumers.

Their purpose is participation awareness. A listing answers, in common form, that a Guild Event presently offers a meaningful avenue for guild participation and when that participation-relevant occurrence is expected or underway.

A module owns a concrete guild participation capability and its procedure. When one concrete occurrence of that capability is presently eligible for shared participation awareness, the module translates the truth it owns into a Guild Event Listing. Consumers read that listing rather than learning the module that produced it.

The relationship is:

```text
Module
    owns participation truth and procedure
        ↓ translates one currently participation-relevant occurrence into
Guild Event Listing
    conforms to the Guild Event Listing Contract
        ↓ established in
Guild Event Registry
        ↓ read by
Consumer
    understands listings, not modules
```

The Guild Event Listing Contract defines the common vocabulary through which modules describe currently participation-relevant Guild Events to consumers. It is not a history contract.

## Eligibility

A concrete module-owned occurrence is eligible for a Guild Event Listing only while shared awareness can still lead a member toward a meaningful participation avenue.

The owning module decides when that condition is true because the module owns the procedure and knows what participation means for its ceremony.

Conceptually:

```text
meaningful participation avenue exists
    → listing may be established

participation avenue no longer exists
    → listing is withdrawn
```

Withdrawal does not erase or reinterpret module history. It means only that the occurrence is no longer eligible for current participation awareness through the Guild Event Listing contract.

A module remains solely responsible for preserving the history, result, audit evidence, and ceremony-specific meaning of concluded or otherwise no-longer-participatory occurrences.

Raffle is the current concrete example:

```text
listed raffle round
    → eligible: upcoming participation awareness matters

live raffle round
    → eligible: participation is active

concluded raffle round
    → not eligible: raffle history belongs to Raffle

listed round cancelled before going live
    → not eligible after cancellation: no participation avenue remains
```

A never-live cancelled raffle may remain historically real inside Raffle without remaining a Guild Event Listing.

## Guild Event Listing Contract

Every Guild Event Listing requires:

```text
guild_event_id
guild_event_kind
guild_event_occurs_at
```

These are the irreducible coordinates of a listing:

- `guild_event_id` identifies the concrete Guild Event occurrence and must be globally unique among Guild Events in Guild Operations.
- `guild_event_kind` names the concrete ceremony type. It does not necessarily name the module that owns the procedure.
- `guild_event_occurs_at` expresses when the owning module says the currently participation-relevant concrete Guild Event occurs.

`guild_event_occurs_at` follows the repository-wide Unix time persistence rule:

```text
[unix]
    → instant

[unix, unix]
    → range from start to end
```

The owning module determines the truthful temporal shape for each concrete occurrence while that occurrence remains listing-eligible. The registry does not derive temporal meaning from module state.

### Best-known temporal truth

`guild_event_occurs_at` is mutable operational truth, not an immutable copy of the first schedule ever registered.

Guild-operated ceremonies may depend on human scheduling and best-attempt adherence rather than deterministic automation. A scheduled or estimated boundary is therefore authoritative while it is the best truth the owning module has established. When the module later establishes an observed boundary while the occurrence remains participation-relevant, it may re-establish the same Guild Event Listing with the more accurate Unix value.

Conceptually:

```text
future or not-yet-observed boundary
    → scheduled / estimated Unix

observed participation boundary becomes available
    → actual Unix may supersede the estimate
```

This is not historical rewriting. The Guild Event Listing is a projection of the module's best currently established participation-relevant temporal truth. Ceremony-specific history remains owned by the module.

The same Guild Event kind may therefore legitimately change shape or values while it remains listing-eligible. For example, a raffle round may be listed initially as an expected drawing instant and become a live range from actual opening time through expected drawing time. Once the raffle concludes, the listing is withdrawn rather than converted into raffle history.

A valid listing may contain only these required coordinates. Such a listing may be less expressive to a particular consumer, but it remains a complete Guild Event Listing.

## Optional contract fields

Additional listing fields may be optional, but optional does not mean informal or module-defined.

> Every field in a Guild Event Listing, required or optional, has semantics defined by the Guild Event Listing Contract.

The current optional fields are:

```text
guild_event_title
guild_event_destination
guild_event_category
```

`guild_event_title` supplies a human-facing title for the concrete Guild Event. It exists because a consumer may need a useful name that is not equivalent to the machine-oriented `guild_event_kind`. A consumer may use the supplied title when present. When it is absent, a consumer may still express `guild_event_kind` according to its own presentation conventions; doing so presents an existing listing coordinate rather than reconstructing a missing title fact.

`guild_event_destination` supplies the destination associated with the concrete Guild Event. It is not an HTML `href` or a required presentation mechanism. A web consumer may make a listing clickable, a Discord consumer may express the destination differently, and another consumer may ignore it.

A listing without `guild_event_destination` remains valid and is simply informative to a consumer that would otherwise use the destination. The consumer must not reconstruct a destination from the event kind or from knowledge of the owning module.

`guild_event_category` supplies a broader organizational classification for consumers. It does not establish that the Guild Event exists and is not required merely because a particular projection can display or organize by category.

The absence of any optional field is meaningful and complete:

> Consumers may use optional listing fields when present and ignore them when absent. They must not recover missing listing fields through module-specific knowledge.

There is no arbitrary metadata bag. A new optional field belongs in the contract only after real module or consumer pressure demonstrates a shared Guild Event meaning that consumers can understand without knowing which module produced the listing.

## Module boundary

Modules own participation truth and procedure. They decide whether a concrete occurrence is currently eligible for a Guild Event Listing and establish the listing coordinates they can truthfully provide.

A module may establish or re-establish a Guild Event Listing as its participation-relevant truth changes. It withdraws that listing once the occurrence no longer offers a meaningful participation avenue. The registry does not interrogate the module to derive any of those changes.

Re-establishing a listing with more accurate occurrence time is expected behavior when a module replaces scheduled or estimated participation boundaries with observed ones. The module remains responsible for deciding when that newer temporal truth exists.

Listing a Guild Event does not transfer ownership of the module's procedure, participation truth, conclusion, or ceremony-specific historical meaning to the registry.

Modules translate their truth into listings; consumers do not translate module truth themselves.

## Registry boundary

The Guild Event Registry is the common container of currently established Guild Event Listings.

It understands the Guild Event Listing Contract. It does not need to understand:

- raffle or another concrete module;
- module storage or status models;
- member-facing route hierarchy;
- consumer presentation;
- how a module derived the listing it established;
- module-owned historical meaning after listing eligibility ends.

The registry exists so consumers can read one common collection of participation-relevant Guild Event Listings instead of interrogating modules independently.

Registry persistence is implementation support for the shared listing contract, not a second history system. A withdrawn or superseded listing must not be relied upon to preserve module history. If storage retains such rows for implementation reasons, that retention creates no historical ownership or consumer contract.

## Consumer boundary

> Consumers understand Guild Event Listings, not modules.

A consumer reads contract-defined listing fields and decides which listings are relevant to its purpose and how to express them in its medium.

Consumers may specialize presentation based on listing information, including `guild_event_kind`, but they must not use kind as a backdoor for reconstructing absent Guild Event facts. A consumer may choose a visual treatment for a known kind; it may not infer an omitted destination, category, timing, participation state, eligibility rule, or other listing coordinate from module-specific knowledge.

The listing establishes shared participation-awareness facts. The consumer chooses presentation.

`/events` is one such consumer. Its current purpose is prospective participation discovery: it uses listing time to determine which listed Guild Events are happening or upcoming, and it may use other supplied listing coordinates to enrich their presentation. A missing optional coordinate reduces what `/events` can express; it does not authorize `/events` to discover that fact elsewhere.

The first `/events` projection demonstrates why both `guild_event_title` and `guild_event_destination` belong in the optional contract. The raffle module can establish `Guild Raffle` and `/events/raffle` in its listing; `/events` can then present the useful title and interaction without recognizing `raffle-round` as a special case.

A consumer must not treat the registry as a source of concluded module history. Historical raffle rounds, for example, belong to Raffle's own historical projection.

## Contract growth

The contract should grow from concrete projection and module pressure rather than from an imagined generic event schema.

When a consumer needs information that the current listing cannot provide, ask:

1. Is this information necessary for shared participation awareness, or does it belong to module history or consumer presentation?
2. Can any consumer understand the proposed field correctly without knowing which module produced the listing?
3. Does the field need to be present for every valid Guild Event Listing, or can its absence simply reduce what consumers can express?

Only shared participation-awareness meaning belongs in the listing contract. Required fields should remain the smallest set necessary for a coherent Guild Event Listing; additional expressive capability should normally be earned as contract-defined optional fields.

In short:

> Modules expose currently participation-relevant occurrences through Guild Event Listings. The Guild Event Listing Contract defines their shared language. The Guild Event Registry contains those current listings. Consumers use them for participation awareness. The owning module preserves its own history.
