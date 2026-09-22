# Doctrine

Doctrine describes the durable meanings and design constraints that implementations must respect.

Use these documents when deciding **what Guild Operations should mean**, which authority legitimately owns a fact, or whether a proposed abstraction belongs.

- [`architecture.md`](architecture.md) — product purpose, architectural center, authority ownership, interface model, and feature-pressure rules.
- [`member-objects.md`](member-objects.md) — Guildie, Character, roster, selected main, Discord association, session, capability, and Subject meanings.
- [`guild-authority.md`](guild-authority.md) — current Guildie participation and effective-rank derivation.
- [`global-persistence.md`](global-persistence.md) — semantic ownership rules for persisted and derived state.
- [`module-conformity.md`](module-conformity.md) — application-wide invariants every concrete module must respect.
- [`guild-activity.md`](guild-activity.md) — flagship semantic doctrine for lifecycle-bound temporal Guild Activity modules.
- [`participation-semantics.md`](participation-semantics.md) — subordinate semantics for Guild Activities that expose participation.
- [`surface-roles.md`](surface-roles.md) — separation of participation, operations, administration, configurable permissions, and module lifecycle meaning.

Doctrine should remain useful if the current routes, functions, tables, schedulers, or renderers are replaced.
