# AGENTS.md

## Project

This repository contains a lightweight guild operations stack for **OH CRIT I Pulled!**, a World of Warcraft guild and its Discord community.

Guild Operations is the guild's interactive participation layer outside World of Warcraft. WoW remains where the guild exists; this system extends guild activity into places and times where the game client is not available or appropriate.

## Scope boundary

This is not a generic identity platform, an Armory replacement, or a general-purpose guild product.

- World of Warcraft is the native account/Character authority domain.
- Blizzard-authenticated WoW account authority establishes or resolves the durable Guildie and which Characters that Guildie controls.
- Character is the member object of Blizzard's guild organization.
- Guildie is the member object of the real-world guild organization around it.
- `Subject` is contextual language for an already-existing object in relation; it is not a domain object or persistence coordinate.
- Discord is an optional associated resolver and interaction surface for an existing Guildie.
- Character presentation should favor recognition cues needed for guild participation rather than profile completeness.
- Do not introduce generic provider/platform abstractions unless the repository develops a concrete need for them.

A useful product test is whether a capability helps establish authority to participate, enable guild participation, operate that participation, or preserve its history.

## Architectural invariants

- The backend owns authoritative operational state.
- Interfaces are projections and interaction surfaces, not independent sources of operational truth.
- Discord identity must not create the canonical Guildie.
- Changing Discord accounts or a selected main character must not create a new Guildie or rewrite historical activity.
- Blizzard owns current Blizzard facts such as account control, guild Character membership, and numeric guild rank.
- Guild Operations owns the meaning and presentation it assigns to those facts outside WoW, including rank-derived application capabilities.
- Persist actual domain objects and relationship roles (`guildie_id`, Character coordinates, `round_id`, etc.); do not introduce generic `subject_id` persistence.
- Human guild judgments remain human judgments. Code may enforce permissions, required inputs, and valid transitions, but must not manufacture authority unavailable from the actual source.
- Guild Operations preserves, enables, and enriches community participation; it does not replace the community processes that give participation meaning.

## Recognition surfaces

Member-facing recognition should be concise and operationally relevant.

The strongest default cues are:

- character name;
- class / active specialization;
- realm; and
- current guild rank.

Facts such as race, level, item level, achievements, and similar profile information are incidental unless a concrete workflow requires them.

When a known semantic fact is likely to gain richer presentation later, prepare a narrow presentation seam rather than implementing speculative styling or policy.

## Development approach

Keep changes small, direct, and domain-specific.

- Do not create numbered task documents.
- Do not create development journals.
- Avoid speculative abstractions and infrastructure.
- Prefer explicit Guildie/Character/WoW/Discord semantics over generalized identity machinery.
- Preserve durable architectural decisions in `docs/architecture.md` when a change materially affects later work.
- Do not assume Blizzard API behavior. Verify current contracts before implementing authority-bearing behavior.
- Prefer concrete participation features over additional foundational modeling when the existing model is sufficient.
- Let shared event, notification, audit, participation, or interface abstractions emerge from demonstrated overlap between real features rather than designing them in isolation.

## Current objective

The foundational authority model is sufficiently established. The next product-level question is:

> **What does a guild member get to do with Guild Operations?**

Build concrete guild participation capabilities and allow new shared machinery to emerge under feature pressure.
