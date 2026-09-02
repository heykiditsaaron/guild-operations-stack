# AGENTS.md

## Project

This repository contains a lightweight guild operations stack for a World of Warcraft guild and its Discord community.

## Scope boundary

This is not a generic identity platform.

- World of Warcraft is the native identity domain.
- Blizzard-authenticated WoW identity establishes the canonical operational subject.
- Discord is an associated resolver and interaction surface.
- Do not introduce generic provider/platform abstractions unless the repository develops a concrete need for them.

## Architectural invariants

- The backend owns authoritative operational state.
- Interfaces are projections and interaction surfaces, not independent sources of operational truth.
- Discord identity must not create the canonical subject.
- Changing Discord accounts or a selected main character must not create a new subject or rewrite historical activity.
- Human guild judgments remain human judgments. Code may enforce permissions, required inputs, and valid transitions, but must not manufacture authority unavailable from the actual source.

## Development approach

Keep changes small, direct, and domain-specific.

- Do not create numbered task documents.
- Do not create development journals.
- Avoid speculative abstractions and infrastructure.
- Prefer explicit WoW/Discord semantics over generalized identity machinery.
- Preserve durable architectural decisions in `docs/architecture.md` when a change materially affects later work.
- Do not assume Blizzard API behavior. Verify current contracts before implementing authority-bearing behavior.

## Current objective

Establish or resolve the canonical WoW-rooted subject from successful Blizzard authentication.
