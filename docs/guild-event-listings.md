# Guild Event Listings

Guild Event Listings are the shared language between participation modules and consumers of Guild Event information.

A module owns a concrete guild participation capability and its procedure. When one concrete occurrence of that capability is a Guild Event, the module translates the truth it owns into a Guild Event Listing. Consumers read that listing rather than learning the module that produced it.

The relationship is:

```text
Module
    owns participation truth and procedure
        ↓ translates one concrete Guild Event into
Guild Event Listing
    conforms to the Guild Event Listing Contract
        ↓ established in
Guild Event Registry
        ↓ read by
Consumer
    understands listings, not modules
```

The Guild Event Listing Contract is therefore more than admission criteria. It defines the common vocabulary through which modules describe Guild Events to consumers.

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
- `guild_event_occurs_at` expresses when the owning module says the concrete Guild Event occurs.

`guild_event_occurs_at` follows the repository-wide Unix time persistence rule:

```text
[unix]
    → instant

[unix, unix]
    → range from start to end
```

The owning module determines the truthful temporal shape for each concrete occurrence. The registry does not derive temporal meaning from module state.

A valid listing may contain only these required coordinates. Such a listing may be less expressive to a particular consumer, but it remains a complete Guild Event Listing.

## Optional contract fields

Additional listing fields may be optional, but optional does not mean informal or module-defined.

> Every field in a Guild Event Listing, required or optional, has semantics defined by the Guild Event Listing Contract.

The current optional fields are:

```text
guild_event_destination
guild_event_category
```

`guild_event_destination` supplies the destination associated with the concrete Guild Event. It is not an HTML `href` or a required presentation mechanism. A web consumer may make a listing clickable, a Discord consumer may express the destination differently, and another consumer may ignore it.

A listing without `guild_event_destination` remains valid and is simply informative to a consumer that would otherwise use the destination. The consumer must not reconstruct a destination from the event kind or from knowledge of the owning module.

`guild_event_category` supplies a broader organizational classification for consumers. It does not establish that the Guild Event exists and is not required merely because a particular projection can display or organize by category.

The absence of any optional field is meaningful and complete:

> Consumers may use optional listing fields when present and ignore them when absent. They must not recover missing listing fields through module-specific knowledge.

There is no arbitrary metadata bag. A new optional field belongs in the contract only after real module or consumer pressure demonstrates a shared Guild Event meaning that consumers can understand without knowing which module produced the listing.

## Module boundary

Modules own participation truth and procedure. They decide whether a concrete Guild Event exists and establish the listing coordinates they can truthfully provide.

A module may establish, re-establish, or withdraw a Guild Event Listing as its owned truth changes. The registry does not interrogate the module to derive those changes.

Listing a Guild Event does not transfer ownership of the module's procedure, participation truth, or ceremony-specific historical meaning to the registry.

Modules translate their truth into listings; consumers do not translate module truth themselves.

## Registry boundary

The Guild Event Registry is the common container of Guild Event Listings established by modules.

It understands the Guild Event Listing Contract. It does not need to understand:

- raffle or another concrete module;
- module storage or status models;
- member-facing route hierarchy;
- consumer presentation;
- how a module derived the listing it established.

The registry exists so consumers can read one common collection of Guild Event Listings instead of interrogating modules independently.

Persistence may preserve registrations after their immediate discovery relevance has passed, but that does not make the registry a generic history system or require it to understand ceremony-specific history.

## Consumer boundary

> Consumers understand Guild Event Listings, not modules.

A consumer reads contract-defined listing fields and decides which listings are relevant to its purpose and how to express them in its medium.

Consumers may specialize presentation based on listing information, including `guild_event_kind`, but they must not use kind as a backdoor for reconstructing absent Guild Event facts. A consumer may choose a visual treatment for a known kind; it may not infer an omitted destination, category, timing, participation state, eligibility rule, or other listing coordinate from module-specific knowledge.

The listing establishes shared Guild Event facts. The consumer chooses presentation.

`/events` is one such consumer. Its current purpose is prospective participation discovery: it uses listing time to determine which registered Guild Events are happening or upcoming, and it may use other supplied listing coordinates to enrich their presentation. A missing optional coordinate reduces what `/events` can express; it does not authorize `/events` to discover that fact elsewhere.

## Contract growth

The contract should grow from concrete projection and module pressure rather than from an imagined generic event schema.

When a consumer needs information that the current listing cannot provide, ask:

1. Is this information about the Guild Event itself, or merely presentation chosen by this consumer?
2. Can any consumer understand the proposed field correctly without knowing which module produced the listing?
3. Does the field need to be present for every valid Guild Event Listing, or can its absence simply reduce what consumers can express?

Only shared Guild Event meaning belongs in the listing contract. Required fields should remain the smallest set necessary for a coherent Guild Event Listing; additional expressive capability should normally be earned as contract-defined optional fields.

In short:

> Modules translate concrete Guild Event truth into Guild Event Listings. The Guild Event Listing Contract defines their shared language. The Guild Event Registry contains those listings. Consumers understand listings, not modules.
