# Infrastructure

Infrastructure documentation describes current shared machinery and how to use or operate it correctly.

Use these documents when implementing against an existing facility, operating it, debugging its behavior, or determining its current invocation and contract boundaries.

## Blizzard and member infrastructure

- [`blizzard-account-authority.md`](blizzard-account-authority.md) — Blizzard login and self-refresh ceremonies plus account/control reconciliation.
- [`blizzard-request-boundary.md`](blizzard-request-boundary.md) — shared Blizzard authority GET pacing and retry behavior.
- [`guild-refresh.md`](guild-refresh.md) — roster reconciliation, manual/CLI/automatic invocation, scheduling, and follow-up acquisition.
- [`character-presentation-acquisition.md`](character-presentation-acquisition.md) — shared Blizzard Character profile/media acquisition facility.
- [`guild-permissioning.md`](guild-permissioning.md) — rank-definition and global capability machinery.
- [`guildie-discord-state.md`](guildie-discord-state.md) — Discord-authoritative Guildie sidecar observation, managed role projection, reconciliation, and inspection.

## Shared participation infrastructure

- [`guild-event-discovery.md`](guild-event-discovery.md) — enduring Offering and temporal Calendar Listing contracts used by Guild Event discovery.
- [`wow-trait-index.md`](wow-trait-index.md) — game-authored class/spec capability registry for high-visibility group evaluation.

## Application infrastructure

- [`web-rendering.md`](web-rendering.md) — shared rendering, shell, controls, navigation, origin, and asset behavior.
- [`module-lifecycle.md`](module-lifecycle.md) — packaged-module enablement, persistence, administration, and runtime gating.
- [`operational-inspection.md`](operational-inspection.md) — publishing and inspecting durable administrative operation evidence.
- [`privileged-surface-audit.md`](privileged-surface-audit.md) — current privileged web surface classification and migration ownership across participation, operations, and administration.

Infrastructure documents may repeat a doctrinal constraint briefly when required for safe use, but the authoritative design reasoning belongs in [`../doctrine/`](../doctrine/).
