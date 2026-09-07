# Doctrine

Doctrine describes the durable meanings and design constraints that implementations must respect.

Use these documents when deciding **what Guild Operations should mean**, which authority legitimately owns a fact, or whether a proposed abstraction belongs.

- [`architecture.md`](architecture.md) — product purpose, architectural center, authority ownership, interface model, and feature-pressure rules.
- [`member-objects.md`](member-objects.md) — Guildie, Character, roster, selected main, Discord association, session, capability, and Subject meanings.
- [`guild-authority.md`](guild-authority.md) — current Guildie participation and effective-rank derivation.
- [`global-persistence.md`](global-persistence.md) — semantic ownership rules for persisted and derived state.
- [`module-creation.md`](module-creation.md) — design guidance for introducing and bounding concrete modules.

Doctrine should remain useful if the current routes, functions, tables, schedulers, or renderers are replaced.
