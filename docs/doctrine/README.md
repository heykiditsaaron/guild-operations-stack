# Doctrine

Doctrine describes the durable meanings and design constraints that implementations must respect.

Use these documents when deciding **what Guild Operations should mean**, which authority legitimately owns a fact, or whether a proposed abstraction belongs.

The doctrine hierarchy is intentionally small:

- [`installation-lifecycle.md`](installation-lifecycle.md) — reset, rebind, reinstall, and external responsibility boundaries.
- [`architecture.md`](architecture.md) — product purpose, architectural center, authority ownership, application boundaries, persistence law, interface model, and feature-pressure rules.
- [`member-objects.md`](member-objects.md) — Identity, WoW Account authority, Actor resolution, Character control, derived Guildie status, representation, session, and rank-derived capability meanings.
- [`guild-activity.md`](guild-activity.md) — Core Activity meaning: occurrence lifecycle, temporal relevance, Participation, shared language, and ownership.
- [`activity-plugin-contract.md`](activity-plugin-contract.md) — Activity plugin boundary: procedure, declarations, projections, lifecycle meaning, Participation ceremony, and Core responsibilities.
- [`module-conformity.md`](module-conformity.md) — legacy Module doctrine retained for deferred cleanup of remaining Module-era capabilities; it does not govern Activity plugins.

The relationship is:

```text
Architecture
├── Member Objects
└── Activity
    └── Activity Plugin Contract
```

This is a governance relationship, not an implementation inheritance model.

A rule belongs in Architecture when it is true of Guild Operations as a whole; in Member Objects when it defines member or organizational authority meaning; in Activity when it is true because something is a systemic Activity concept; and in the Activity Plugin Contract when it governs the seam between concrete procedure and Activity/Core. Rules belonging only to Raid, Raffle, Calendar, Discord, or another concrete domain remain with that owner rather than becoming global doctrine.

`module-conformity.md` remains only as legacy doctrine for Module-era capabilities that have not yet received their own cleanup. Activity plugins do not inherit from or conform to the Module category.

Doctrine should remain useful if the current routes, functions, tables, schedulers, renderers, or source layout are replaced.
