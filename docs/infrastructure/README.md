# Infrastructure

Infrastructure documentation describes current shared machinery and how to use or operate it correctly.

Use these documents when implementing against an existing facility, operating it, debugging its behavior, or determining its current invocation and contract boundaries.

## Authority and member machinery

- [`authentication-ceremony.md`](authentication-ceremony.md) — Blizzard login ceremony and session establishment.
- [`persistence-boundary.md`](persistence-boundary.md) — account/control establishment and existing-Guildie reconciliation transactions.
- [`guild-permissioning.md`](guild-permissioning.md) — rank-definition and global capability machinery.
- [`guild-refresh.md`](guild-refresh.md) — roster reconciliation, manual/CLI/automatic invocation, scheduling, and follow-up acquisition.
- [`self-account-refresh.md`](self-account-refresh.md) — authenticated Guildie self-refresh ceremony.
- [`character-presentation-acquisition.md`](character-presentation-acquisition.md) — shared Blizzard Character profile/media acquisition facility.

## Shared participation infrastructure

- [`guild-event-calendar.md`](guild-event-calendar.md) — Calendar Listing contract, registry, and consumer rules.
- [`guild-event-offerings.md`](guild-event-offerings.md) — enduring Guild Event Offering registration contract.

## Application infrastructure

- [`web-rendering.md`](web-rendering.md) — shared rendering, shell, controls, navigation, origin, and asset behavior.
- [`operational-inspection.md`](operational-inspection.md) — publishing and inspecting durable administrative operation evidence.

Infrastructure documents may repeat a doctrinal constraint briefly when required for safe use, but the authoritative design reasoning belongs in [`../doctrine/`](../doctrine/).
