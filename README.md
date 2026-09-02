# Guild Operations Stack

A lightweight, WoW-native backend for guild operations.

The system is rooted in a Blizzard-authenticated World of Warcraft subject. Discord is an associated resolver and interaction surface, not an independent identity root.

## Initial direction

The first goal is to establish or resolve the canonical WoW-rooted subject from Blizzard authentication. Later guild features such as raffle handling, Hidden in Plain Sight, and other event workflows will build on that same continuity.

## Project principles

- World of Warcraft is the native identity domain.
- Blizzard authentication establishes the root subject.
- Discord resolves onto that WoW-rooted subject.
- Backend state is authoritative; interfaces are projections and interaction surfaces.
- Human guild decisions remain human decisions. The backend records and enforces procedure rather than inventing authority.
- Keep the project lightweight. No task ledger or development journals are required.

See `docs/architecture.md` for durable architectural decisions.
