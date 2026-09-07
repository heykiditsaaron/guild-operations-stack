# Architecture

## Purpose

Guild Operations exists specifically for **OH CRIT I Pulled!**.

It is the guild's interactive **participation and operation layer outside World of Warcraft**. World of Warcraft and Discord remain primary places where the guild exists and communicates; Guild Operations provides a neutral, knowledgeable place where guild-owned operational truth can be established and then expressed appropriately across those interfaces.

Guild Operations is not an Armory replacement, a generic identity platform, a general-purpose guild-management product, or an attempt to move the guild out of WoW or Discord.

A useful product test is:

> Does this help establish authority to participate, enable guild participation, operate that participation, or preserve its history?

If not, it probably does not belong.

## Architectural center

The backend owns singular truthful operational state.

Web, Discord, and any future WoW-facing integration are projections or interaction surfaces over that truth. They may express the same facts differently because their media differ, but they must not become independent owners of the same operational facts.

Authority remains with the system that legitimately owns each fact:

- **Blizzard** owns authenticated account control, current WoW guild membership, Characters, and numeric guild rank.
- **Guild Operations** owns meanings and procedures established by the guild outside WoW.
- **Human guild members** remain authoritative for judgments no machine can legitimately make.

Guild Operations should automate procedure, enforcement, recording, resolution, and presentation where useful. It should not manufacture authority merely because software could make a decision.

## Member and authority model

Guild Operations distinguishes durable guild-member continuity from the Blizzard objects and observations used to establish current authority.

Conceptually:

```text
Guildie
├── Blizzard account authority
├── WoW account(s)
│   └── Character(s)
├── selected main
├── optional Discord association
└── derived Guild Operations capabilities
```

The important architectural distinctions are:

- **Guildie** is durable member continuity in the real-world guild organization.
- **Blizzard authentication** establishes account authority.
- **Character** is a durable WoW object and a useful recognition surface.
- **Current guild membership and numeric rank** are current Blizzard observations.
- **Selected main** is Guild Operations presentation preference, never identity or authorization.
- **Discord association** is an optional resolver to an existing Guildie. Discord never creates the canonical member.
- **Capabilities** translate current authority into explicit Guild Operations permissions.
- **Session identity** resolves to the Guildie.

These concepts must not be collapsed merely because they currently describe the same human.

The detailed member contract lives in [`member-objects.md`](member-objects.md). Authentication and authority ceremonies are documented separately in [`authentication-ceremony.md`](authentication-ceremony.md), [`guild-authority.md`](guild-authority.md), and [`guild-permissioning.md`](guild-permissioning.md).

## Subject is contextual language

Guild Operations has no universal persisted domain object called **Subject**.

A subject is only the object currently being designated by a statement, question, event, or operation. Subjecthood creates no durable coordinate, ownership, persistence, authorization, or identity semantics of its own.

Persist and name actual objects and relationships such as `guildie_id`, Character coordinates, `round_id`, `claim_id`, and `guild_event_id`. Do not introduce a generic `subject_id` as a domain shortcut.

## Recognition over profile completeness

Character presentation should favor recognition over profile completeness.

Useful recognition cues currently include:

- character name;
- class and active specialization, when available;
- realm; and
- current guild rank.

Additional Blizzard data should be introduced when a concrete guild workflow requires it, not because Blizzard exposes it. Guild Operations should not drift toward an Armory-style profile product.

Where likely future presentation needs are inexpensive to accommodate, prepare semantic seams without inventing the future feature itself:

> Prepare the seam, not the speculative feature.

## Persistence and observation

Guild Operations preserves distinctions between durable objects, current external observations, guild-owned meaning, and historical participation.

Current Blizzard observations may change without erasing durable continuity or rewriting history. For example, a Character may cease to be currently present on the guild roster without deleting the Character, the Guildie who controls it, or prior participation records involving either.

Persistence ownership and transactional boundaries are defined in [`global-persistence.md`](global-persistence.md) and [`persistence-boundary.md`](persistence-boundary.md).

### Time

All persisted values representing instants in time use **Unix timestamps**. Human-readable date, time, and timezone are presentation concerns derived from those persisted values.

Interfaces should present time in the viewer's local timezone when the medium can determine it. Local wall-clock input must be converted to canonical Unix time before persistence. Server or container timezone must not silently become persistence or presentation policy.

A temporal range is represented by two Unix values; an instant by one. Contracts that use time define the semantic meaning of those values rather than introducing a separate generic time-type framework.

## Human authority

Some guild procedures require judgment that Guild Operations cannot legitimately derive from external data.

In those cases the backend should establish who may decide, constrain the procedure, record the decision, and preserve the result. It should not pretend to verify facts outside its authority.

This distinction allows software to automate ceremony without replacing the guild members who are actually authorized to make the judgment.

## Participation and modules

Concrete guild activities are the product pressure that should drive architecture.

A **module** owns a concrete participation capability and its procedure. Shared machinery may project or organize module-owned truth, but it must not silently become the owner of that truth.

Raffle is the first substantial example: the raffle module owns raffle procedure and truth even when raffle rounds appear on shared Events surfaces, administrative interfaces, Discord projections, or preserved history.

Shared abstractions should be introduced only after multiple real features demonstrate the need. Do not pre-design generic event, notification, identity, audit, participation, or similar frameworks merely because they can be imagined.

> Build the guild activity. Let the common machinery reveal itself under pressure.

Module-authoring guidance lives in [`module-creation.md`](module-creation.md).

## Guild Events

Guild Events provide shared discovery infrastructure around concrete guild-operated happenings without taking ownership of the participating module's domain truth.

Two distinct shared contracts have been earned:

- **Guild Event Calendar** answers what concrete occurrence happens when.
- **Guild Event Offerings** answer what enduring participation capabilities the guild offers.

These contracts are intentionally separate. A capability may be discoverable as an offering without a currently scheduled occurrence, while a concrete occurrence may have calendar meaning established by its owning module.

Temporal occurrences are documented in [`guild-event-calendar.md`](guild-event-calendar.md). Enduring activity discovery is documented in [`guild-event-offerings.md`](guild-event-offerings.md).

Member-facing route hierarchy describes where users encounter a capability; it does not define implementation ownership. A module may therefore appear under `/events` without becoming structurally owned by Guild Events.

## Interface model

Interfaces are projections and interaction surfaces over backend truth.

The web application, Discord, and possible future WoW integrations may each organize and present established facts according to their medium. No interface should become the sole keeper of meaningful guild operational state.

Member-facing context should help a user recognize who is acting and what they may do without turning Guild Operations into a generic profile surface.

Web rendering and navigation ownership are documented in [`web-rendering.md`](web-rendering.md).

## Model maturity and feature pressure

The foundational authority model is infrastructure, not the product destination.

It is intentionally sufficient rather than exhaustive. The next useful architectural pressure should come from concrete guild participation and operation capabilities.

When a new feature creates tension, prefer the smallest concrete change that lets that feature work correctly. Introduce another shared distinction only when the feature proves one is necessary.

## Workflow

This repository intentionally uses a lightweight development process. It does not use numbered task documents or development journals.

Durable architecture documentation should preserve decisions that materially constrain later work. Historical implementation sequence belongs in Git history rather than permanent architecture documents.
