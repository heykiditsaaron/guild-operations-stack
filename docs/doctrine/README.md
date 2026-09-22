# Doctrine

Doctrine describes the durable meanings and design constraints that implementations must respect.

Use these documents when deciding **what Guild Operations should mean**, which authority legitimately owns a fact, or whether a proposed abstraction belongs.

The doctrine hierarchy is intentionally small:

- [`architecture.md`](architecture.md) — product purpose, architectural center, authority ownership, application boundaries, persistence law, interface model, and feature-pressure rules.
- [`member-objects.md`](member-objects.md) — Guildie, Character, Blizzard authority, current organizational participation, effective rank, selected main, Discord association, session, capability, and Subject meanings.
- [`module-conformity.md`](module-conformity.md) — application-wide invariants every concrete module must respect.
- [`guild-activity.md`](guild-activity.md) — specialized doctrine for lifecycle-bound temporal Guild Activities, including optional participation.

The relationship is:

```text
Architecture
├── Member Objects
└── Module Conformity
    └── Guild Activity
        └── optional Participation
```

This is a governance hierarchy, not an implementation inheritance model.

A rule belongs in Architecture when it is true of Guild Operations as a whole; in Member Objects when it defines member or organizational authority meaning; in Module Conformity when every module must respect it; and in Guild Activity when it is true specifically because a domain establishes Guild Activities. Rules belonging only to Raid, Raffle, Discord, Calendar, or another concrete domain remain with that domain rather than becoming global doctrine.

Doctrine should remain useful if the current routes, functions, tables, schedulers, renderers, or source layout are replaced.
