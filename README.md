# Guild Operations Stack

A lightweight, WoW-native backend for guild operations.

Guild Operations represents two related membership realms: Character is the member object of Blizzard's WoW guild organization, while Guildie is the durable member object of the real-world guild organization around it. Blizzard-authenticated account authority establishes or resolves a Guildie and which Characters that Guildie controls. Discord is an optional associated resolver and interaction surface.

`Subject` is contextual language for whichever existing object a statement or relation is about; it is not a persisted domain object or canonical identifier.

## Project direction

Guild Operations uses Blizzard authority and the current Character roster to establish who can participate, then builds concrete guild participation capabilities such as raffles and other guild activities on that truthful foundation.

## Project principles

- Blizzard owns authenticated account control, Characters, current WoW guild Character membership, and numeric guild rank.
- Guild Operations owns the durable Guildie representation and guild-established operational truth outside WoW.
- Discord resolves onto an existing Guildie; it does not establish canonical membership.
- Persist concrete objects and relationship roles rather than a generic Subject abstraction.
- Backend state is authoritative; interfaces are projections and interaction surfaces.
- Human guild decisions remain human decisions. The backend records and enforces procedure rather than inventing authority.
- Keep the project lightweight. No task ledger or development journals are required.

See `docs/architecture.md` and `docs/member-objects.md` for durable architectural decisions.
