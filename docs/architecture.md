# Architecture

## Purpose

Guild Operations exists specifically for **OH CRIT I Pulled!** and its Discord community.

Its purpose is to provide an interactive participation layer for the guild outside of World of Warcraft. World of Warcraft remains where the guild exists; Guild Operations extends the guild's activities into places and times where the game client is not available or appropriate.

Guild Operations is not an Armory replacement, a generic identity-linking platform, or a general-purpose guild product.

The system should be judged primarily by whether a capability helps to:

- establish authority to participate as a guild member;
- enable guild participation;
- operate guild participation; or
- preserve the history and results of that participation.

A useful product test is:

> Does this help establish authority to participate, enable guild participation, operate that participation, or preserve its history?

If not, it probably does not belong.

## Architectural center

OH CRIT I Pulled! is represented in two related organizational realms:

```text
World of Warcraft / Blizzard
    → guild organization
    → member object: Character

real-world guild organization around it
    → Guild Operations
    → member object: Guildie
```

Blizzard account authority establishes or resolves the Guildie and which Characters that Guildie currently controls. Blizzard's guild roster separately establishes which Characters currently belong to the WoW guild and their numeric ranks.

Conceptually:

```text
Blizzard authentication
        ↓
Guildie establishment / resolution
        ↓
controlled Characters
        ∩
Blizzard Character roster
        ↓
current Guildie participation surface + effective rank
        ↓
participate in OH CRIT I Pulled!
```

Blizzard authentication answers:

> Which Blizzard account context and Characters is this Guildie allowed to act through?

Guild Operations then answers:

> What does this Guildie do, receive, join, claim, earn, and participate in within OH CRIT I Pulled!?

The foundational authority model exists to make that second question safe and durable. It is not the product destination by itself.

## Subject is contextual language

Guild Operations has no universal domain object called **Subject** and does not persist one.

A subject is whichever already-existing object is being designated in relation to a particular question, statement, event, or operation. That role can legitimately change with context:

```text
"What event happens tomorrow?"
    subject may be a raffle round

"Who won the raffle?"
    subject may be a Character

"Who controls that Character?"
    relevant object is the Guildie
```

Subjecthood therefore creates no durable coordinate, ownership, persistence, authorization, or identity semantics of its own.

Persist and name actual objects and relationships such as `guildie_id`, Character coordinates, `round_id`, `claim_id`, and `guild_event_id`. Do not introduce a generic `subject_id` as a domain shortcut.

## Guildie continuity

A **Guildie** is Guild Operations' durable representation of the real-world guild organizational member: the account holder and control representative for their WoW Characters.

The durable Guild Operations coordinate is:

```text
guildie_id
```

Conceptually:

```text
Guildie
├── guildie_id
├── Blizzard account authority
├── controlled Characters
├── selected main
├── optional Discord association
├── participation history
└── current derived guild state
```

Discord must never create the Guildie or an independent canonical member. A Discord identity may resolve to an existing Guildie after an explicit linking flow.

Changing Discord accounts or changing a selected main character must not create a new Guildie and must not rewrite historical guild activity.

Guildie continuity is non-destructive. A Guildie remains known even when none of their controlled Characters are currently on the Blizzard Character roster. What disappears in that state is the current guild participation surface and rank-derived authority, not the Guildie.

## Authentication and member authority

Blizzard authentication exists so a person interacting outside of the game can prove authority over the WoW account context that contains their Characters.

The authenticated Blizzard account provides an authoritative observation of Characters currently controlled by the Guildie. Guild Operations can use that control relationship to support declarations such as:

- selecting a guild main;
- identifying which Character made a raffle deposit;
- selecting a Character for a raid signup;
- identifying the Character used for an activity or submission.

Authentication is therefore primarily an authority boundary, not a rich profile surface.

## Character representation and recognition

A **Character** is the durable WoW object and the member object of Blizzard's guild organization. Character representation should remain deliberately light and should favor **recognition cues** over profile completeness.

For Guild Operations, the most useful current recognition cues are the facts that answer how a member is encountered in normal guild play:

- character name;
- class and active specialization, when available;
- realm; and
- current guild rank.

Those cues are operationally meaningful for distinct reasons:

```text
class / specialization
    → how the Character primarily participates in gameplay

realm
    → where that Character exists in WoW

guild rank
    → how that Character currently participates in OH CRIT I Pulled!
```

Other Blizzard facts such as level, race, item level, achievements, and similar profile information may be legitimate observations but are incidental to this recognition purpose unless a concrete guild workflow requires them.

Guild Operations should not recreate an Armory-style character profile. Rich character inspection already exists elsewhere and is outside this system's purpose.

A portrait or avatar is useful because it improves quick recognition in selection interfaces; it is presentation enrichment, not identity-critical state.

Recognition surfaces should prepare semantic styling seams when a known guild fact is likely to gain stronger recognition treatment later. For example, guild rank presentation may expose a stable rank-specific presentation hook without prematurely defining colors, badges, or other visual policy. Prepare the seam, not the speculative feature.

## Character roster and Guildie roster

The **Character roster** is the current in-game guild roster dictated by the actual World of Warcraft environment and observed through Blizzard.

For a Character, the relevant guild state is deliberately simple:

```text
currently on the Character roster
    → Blizzard numeric guild rank

not currently on the Character roster
    → no current guild membership
```

The **Guildie roster** is Guild Operations-derived organizational membership. It is computed by intersecting the Characters currently controlled by a Guildie with the current Blizzard Character roster:

```text
Guildie's currently controlled Characters
                ∩
current Blizzard Character roster
                ↓
current Guildie organizational membership
```

At least one controlled roster Character gives the Guildie a current participation surface. Zero controlled roster Characters leaves the Guildie durable and known but without current guild-facing participation or rank-derived authority.

This allows the system to distinguish among:

- Characters known to Blizzard and Guild Operations;
- Characters currently present on the Blizzard Character roster;
- Characters controlled by a particular Guildie; and
- the derived Guildie organizational membership created by the intersection of those facts.

## Guild authority

Blizzard publishes two independent authority surfaces that Guild Operations can join:

```text
Authenticated Account Profile
        ∩
Public OH CRIT I Pulled! Character Roster
        ↓
current roster Characters controlled by the Guildie
        ↓
current Guildie participation surface + effective rank
```

Live reconnaissance proved that both Blizzard surfaces expose the same durable Character coordinate shape: region, realm id, and character id. Character roster membership should therefore be resolved by those Blizzard-native coordinates rather than by character name.

The canonical guild reference is Blizzard numeric guild id `65431436`. The guild's name, realm labels, faction, and similar fields are observed presentation state. They may change without changing the guild's identity.

Roster observations are current Blizzard truth, not destructive history reconciliation. A Character disappearing from a later roster observation should cease to be currently present without erasing that Character, the Guildie, or historical Guild Operations activity involving either.

## Guild rank projection

Blizzard publishes a numeric rank on each Character roster membership but does not expose OH CRIT I Pulled!'s custom rank names through the Guild Profile or Guild Roster surfaces observed in live reconnaissance.

Therefore:

> Blizzard owns the numeric guild rank fact on each current Character. Guild Operations owns configurable meaning and presentation for that number outside WoW and derives a Guildie's effective rank from current controlled roster Characters.

Conceptually:

```text
Guild 65431436 / Rank N
├── canonical
│   └── rank_index = N
└── Guild Operations metadata
    ├── display_name
    ├── active/inactive presentation state
    ├── later: Discord role projection
    └── member-facing capabilities
```

A Guildie's effective rank is the highest-authority rank among their currently controlled Characters on the Character roster. Under Blizzard's current ordering, the lowest numeric `rank_index` is the highest-authority rank.

Rank metadata must be keyed by the canonical numeric rank rather than inferred from currently populated roster values. The guild intentionally leaves rank `6` unused today, demonstrating that the observed rank set may be sparse.

Discord roles and Guild Operations capabilities may both project from the same rank metadata, but Discord role membership must not become backend authorization truth. System operator authority remains a separate first-party authorization concern and is not implied by WoW guild rank.

Guild rank is also a valid Character and Guildie recognition cue. Presentation may eventually use rank names, colors, badges, or other distinctions, but those treatments are Guild Operations presentation policy layered over Blizzard's current numeric rank fact.

## Interface model

The backend owns singular truthful operational state. Interfaces present and manipulate that state according to their medium.

Expected interfaces include:

- Web dashboard
- Discord bot / BotGhost integration
- A possible future WoW addon

No interface should become the sole keeper of meaningful guild operational state.

Member-facing interfaces may display a small persistent member context or "member strip" so the user can recognize which Guildie is acting while participating. That presentation is context for interaction, not a profile product.

The member context should answer three progressively different questions without collapsing them into one generic account surface:

```text
Who am I presenting as?
What is associated with me?
What can I do in this session?
```

For web access, authentication begins with Blizzard/Battle.net authorization and resolves or establishes the durable `guildie_id` that identifies which Guildie is operating the application session.

### Time representation and presentation

All persisted values that represent an instant in time **must be Unix timestamps**. Persistence must not encode a human-readable date/time string, server-local wall-clock value, or timezone-formatted representation in place of the canonical Unix value.

Human-readable date and time are presentation. Interfaces derive them from the persisted Unix timestamp and should express the instant in the **viewer's local timezone** whenever the medium can determine it. In the web application, browser-side formatting should therefore be preferred over server-local date formatting for member- and administrator-facing timestamps.

A local date/time input represents the entering person's local wall-clock choice and must be converted to the canonical Unix timestamp before persistence.

The distinction is:

```text
persistence
    → Unix timestamp

human expression
    → derive from Unix
    → viewer-local date and time
```

Server/container timezone must not silently become persistence or presentation policy.

## Human authority

Guild Operations automates persistence, procedure, visibility, and lifecycle management. It does not manufacture human judgment.

Where a guild workflow requires an officer, attendant, or other authorized person to decide something, the backend should record and constrain that decision rather than pretending to verify facts it cannot authoritatively observe.

For example, a raffle claim may precisely reference a Blizzard-authoritative guild Character, while an authorized raffle attendant still decides whether the corresponding guild-bank deposit was actually made.

## Participation model

Guild Operations exists to support guild activity across interfaces and across time.

Examples include:

- raffle claims and adjudication;
- Hidden in Plain Sight events;
- raid signups and participation;
- rewards;
- guild events;
- participation history; and
- future guild activities not yet designed.

These activities may be synchronous or asynchronous. The system should allow the guild to continue participating as a community even when members are not simultaneously logged into World of Warcraft.

Guild Operations preserves, enables, and enriches community participation. It does not replace the human and social processes that give that participation meaning.

## Guild Events

A **Guild Event** is the operational domain representation of a guild-operated ceremony. Member-facing presentation should normally call these simply **Events**; the `guild_event` vocabulary exists to distinguish the operational concept from technical events used by system machinery.

A **module** owns a concrete guild participation capability and its procedure. A **Guild Event** is a concrete occurrence that an appropriate module may list through the shared Guild Event Registration contract. A module is not contained by Guild Events merely because it can establish Guild Event registrations.

Raffle is the first concrete example: the raffle module owns raffle truth and procedure, while individual raffle rounds may be registered as Guild Events for shared discovery. Other modules remain free to own different procedures without being forced through a generic event procedure merely because their concrete occurrences can be discovered together.

Registration is a projection of module-owned truth; it does not transfer ownership of the participation capability, its procedure, or its meaning to the Guild Event Registry.

The required Guild Event registration detail is deliberately small:

```text
guild_event_id
    → which concrete Guild Event occurrence is this?

guild_event_kind
    → what concrete ceremony type is this?

guild_event_occurs_at
    → when does the owning module say this Guild Event occurs?
```

`guild_event_id` must be globally unique among Guild Events in Guild Operations. A consumer should be able to address a concrete Guild Event by its Guild Event ID without also supplying its kind or owning module.

`guild_event_kind` names the concrete ceremony type being discovered, not necessarily the module that implements it. For example, the raffle module owns raffle procedure while a concrete raffle round is registered with kind `raffle-round`.

`guild_event_occurs_at` is established by the owning module. It expresses the module-authoritative temporal meaning of the ceremony occurrence; it is not registry lifecycle, publication time, participation eligibility, or generic module status unless the module itself establishes that as the ceremony's temporal meaning.

`guild_event_occurs_at` follows the repository's Unix time persistence rule:

```text
[unix]
    → instant

[unix, unix]
    → range from start to end
```

The module determines which shape is valid for each concrete occurrence. The same Guild Event kind may therefore legitimately have an instant in one state and a range in another. For raffle, an upcoming round may register only its estimated drawing Unix as an instant, while the single live round may register its started-at Unix through estimated drawing Unix as a range. The raffle module establishes that distinction; the registry does not infer it from raffle status.

`guild_event_category` is standard optional registration metadata. It supplies a broader organizational classification for consumers without establishing that the Guild Event exists. For example, a `raffle-round` may optionally carry category `raffle`.

Modules may additionally establish optional consumable metadata for richer projections. The owning module determines what information is useful to expose. Consumers may use metadata appropriate to their surfaces without requiring every module that lists Guild Events to satisfy a large universal presentation schema.

Conceptually:

```text
Module
├── owns participation truth and procedure
├── establishes concrete Guild Event registrations when appropriate
│   ├── guild_event_id
│   ├── guild_event_kind
│   ├── guild_event_occurs_at
│   └── optional consumable metadata
│       └── guild_event_category
└── posts established registration detail through the Guild Event contract
        ↓
Guild Event Registry
├── durable ledger of Guild Event registrations
├── records registration detail as established by modules
└── exposes registrations
        ↓
Guild Event Consumers
├── discover
├── organize
└── project
```

The Guild Event Registry is the durable ledger of Guild Event registrations established by modules. It does not derive ceremony meaning from module internals. Modules establish registration facts; the registry records and exposes them; consumers consume them.

Registration state may change when a module establishes new truth about the same Guild Event. Such a change must be posted by the owning module rather than inferred by the registry. Calling the registry a ledger does not by itself require an append-only history of every registration mutation; historical revision machinery should be introduced only if a concrete requirement demonstrates that it matters.

Consumers do not need to inspect each module independently or reconstruct Guild Event truth from module-specific state. They consume the common registration ledger and specialize only their interpretation and presentation of the established registration detail.

`/events` is therefore **a Guild Event consumer, not the Guild Event consumer**. It may provide broad temporal discovery with calendar semantics, while other present or future consumers may specialize around promotion, Discord expression, administration, categories, participation contexts, or other concrete needs. Those consumers may present the same registrations differently, but they do not become independent owners of the underlying Guild Event truth.

Member-facing route hierarchy describes where users encounter capabilities; it does not define source or module ownership. A module may therefore be presented under `/events` without being structurally contained by Guild Events. `/events/raffle` remains appropriate member-facing information architecture while raffle implementation ownership remains with the raffle module.

This is discovery, registration, and projection machinery, not a generic event engine.

Guild Event organization should have **calendar semantics without requiring calendar presentation**. Time is the common coordinate by which independently meaningful ceremonies can be ordered, grouped, recognized as current or upcoming, and displayed together. A member-facing `/events` surface may therefore behave like a calendar while presenting guild-specific cards, sections, imagery, and participation routes instead of a conventional calendar grid.

In short:

> Module → Guild Event contract → Guild Event Registry → consumer.

## Model maturity and feature pressure

The foundational model is now sufficient to support concrete member-facing work. It establishes:

- durable Guildie continuity through `guildie_id`;
- Blizzard account authority;
- durable Character continuity;
- Blizzard-authoritative Character roster state;
- derived Guildie organizational membership and effective rank;
- selected-main presentation;
- optional Discord association;
- rank-derived Guild Operations capabilities;
- external refresh and reconciliation boundaries; and
- a renderer boundary in which interfaces project backend truth.

It also establishes a negative boundary:

- `Subject` is contextual designation, not an entity category or persistence coordinate.

Further generalized modeling should not be performed merely because another abstraction can be imagined.

The next useful pressure should come from real guild participation features. Shared event, notification, audit, participation, or interface abstractions should emerge only when multiple concrete workflows demonstrate that they are actually shared.

In short:

> Build the guild activity. Let the common machinery reveal itself under pressure.

## Current implementation direction

The foundational authority and interface model is in place. The next product-level question is no longer primarily "who is this user?" but:

> **What does a Guildie get to do with Guild Operations?**

Concrete participation features should now drive the next architectural discoveries.

## Workflow

This repository intentionally uses a lightweight development process. It does not use numbered task documents or development journals. Architecture documentation should preserve only durable decisions that materially constrain later work.
