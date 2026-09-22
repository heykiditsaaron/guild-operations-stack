# Guild Operations

Guild Operations is the interactive participation and operation layer for **OH CRIT I Pulled!** outside World of Warcraft.

The guild primarily exists and operates through World of Warcraft and Discord. Those are essential places where members play, communicate, and participate, but neither is well suited to being a neutral, knowledgeable place where the guild can establish its own operational truth and then express that truth appropriately across different interfaces.

Guild Operations fills that gap. It enables guild activities outside the game client, gives members durable ways to participate in them, provides the procedures needed to operate them, and preserves their results and history.

It is not an Armory replacement, a generic identity platform, a generic guild-management product, or an attempt to move the guild out of WoW or Discord. It exists around those places so OH CRIT I Pulled! can participate as a guild across interfaces and across time.

A useful product test is:

> **Does this help establish authority to participate, enable guild participation, operate that participation, or preserve its history?**

If not, it probably does not belong.

## What the application does

Guild Operations is built around concrete guild participation capabilities rather than around infrastructure for its own sake.

Current examples include the guild's Raffle and Events experiences. A member can encounter an activity through a member-facing surface while authorized guild members operate that same activity through administrative surfaces. Both are projections over the same backend-owned operational truth.

This relationship is intentional:

```text
Guild activity
    ↓
Guild Operations owns its operational truth
    ↓
member participation + guild operation
    ↓
web / Discord / future WoW-facing expressions
```

The interfaces may express an activity differently because their mediums differ. They should not become independent owners of the same operational facts.

## Authority to participate

Participation needs a trustworthy answer to who is acting and what guild authority they currently possess.

Guild Operations therefore maintains a deliberately WoW-rooted member model:

```text
Guildie
├── Blizzard account authority
├── WoW account(s)
│   └── Character(s)
├── selected main
├── optional Discord association
└── derived Guild Operations capabilities
```

A **Guildie** provides durable continuity for the real-world guild member. A **Character** is the durable WoW object through which that member is normally recognized in game. Blizzard authentication establishes account control, while Blizzard's current guild roster independently establishes current Character membership and numeric guild rank. Guild Operations joins those facts to determine current guild participation and authority.

A selected main is presentation preference, not identity or authorization. Discord may resolve to an existing Guildie after association, but Discord does not create the canonical member.

The member and authority machinery exists to make participation trustworthy. It is infrastructure supporting the guild activities, not the product destination itself.

## Ownership of truth

Authority follows the system or person that can legitimately establish the fact.

- **Blizzard** owns facts such as authenticated account control, Characters, current WoW guild membership, and numeric guild rank.
- **Guild Operations** owns facts and meanings established by OH CRIT I Pulled! outside WoW, including the operational state of its own participation capabilities.
- **Guild members and officers** remain authoritative for judgments no machine can legitimately make. Software may constrain, record, enforce, and present those decisions without manufacturing the judgment itself.

The backend owns singular Guild Operations operational state. Web, Discord, and future WoW integrations are projections or interaction surfaces over that state.

## Building the project

Guild Operations favors concrete guild capabilities over generalized foundations.

Build the guild activity first. Let common machinery reveal itself under pressure. Shared abstractions should be introduced only after multiple real features demonstrate that the same responsibility is genuinely shared.

The existing identity, authority, persistence, rendering, activity-discovery, and Calendar machinery should therefore be treated as infrastructure that has been earned by concrete needs, not as an invitation to generalize the application into a platform.

When future expression is likely but the feature itself has not been earned, prepare an inexpensive semantic seam rather than implementing the speculative feature.

> **Prepare the seam, not the speculative feature.**

## Documentation

Documentation is organized by reader intent. Start with [`docs/README.md`](docs/README.md) for the distinction between doctrine, infrastructure, feature, and reference material.

Core doctrine currently lives in:

- [`docs/doctrine/architecture.md`](docs/doctrine/architecture.md) — system purpose, architectural laws, and ownership boundaries.
- [`docs/doctrine/member-objects.md`](docs/doctrine/member-objects.md) — Guildie, Character, roster, selected-main, session, Discord, and capability meanings.
- [`docs/doctrine/module-conformity.md`](docs/doctrine/module-conformity.md) — application-wide invariants for concrete modules.
- [`docs/doctrine/guild-activity.md`](docs/doctrine/guild-activity.md) — semantic governance for lifecycle-bound temporal Guild Activity modules.

Shared implementation guidance lives under [`docs/infrastructure/`](docs/infrastructure/). Concrete globally owned capabilities live under [`docs/features/`](docs/features/), empirical evidence under [`docs/reference/`](docs/reference/), endpoint reference under [`docs/endpoints/`](docs/endpoints/), and module-owned documentation remains with its owning module documentation.
