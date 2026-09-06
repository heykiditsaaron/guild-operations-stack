# Global Persistence

## Purpose

Define the persistence that belongs to Guild Operations globally so participation modules can orient against one shared operational truth without duplicating it.

This document describes ownership and boundaries. It is not a table-by-table schema catalog, migration inventory, or generic persistence framework.

## Global does not mean everything outside a module

Global persistence is state whose meaning belongs to Guild Operations as a whole rather than to one concrete participation module.

A fact is not globally owned merely because it is stored in the same database, referenced by many modules, or consumed by a global projection.

Persistence ownership follows semantic ownership.

## Globally owned domain state

Guild Operations globally owns durable application objects and shared operational facts needed across participation capabilities.

Current examples include:

```text
Guildie
Blizzard principal binding
WoW account observations
controlled Character observations
Guild
current Blizzard guild roster observations
current Blizzard numeric rank observations
Guild Operations rank definitions
selected main
Discord association
```

These objects and facts are not recreated inside participation modules.

Modules may reference their coordinates while persisting module-specific meaning.

For example, a raffle claim may reference both `claimant_guildie_id` and a participating Character record. Raffle thereby records the meaning those global objects have within the raffle procedure; it does not become the owner of the Guildie, Character, account-control, roster, or rank facts themselves.

## Shared authority state

Guild Operations owns the shared authority facts from which application and module authorization can be derived.

Current global authority inputs include:

- authenticated Guildie continuity;
- Blizzard-demonstrated Character control;
- current Blizzard guild roster membership;
- current Blizzard numeric guild rank;
- globally defined Guild Operations capabilities for globally owned operations.

Modules consume these facts as inputs and may define permission policy specific to their own procedure.

A module must not duplicate global authority state merely to make a local decision.

## Membership references

Current guild membership has one authoritative operational path and must be referenced rather than re-established elsewhere.

The current Character roster is a persisted observation of Blizzard-owned in-game membership. The current Guildie participation surface is derived from the intersection of globally observed Character control and that current Character roster. The Guildie roster is therefore not a second persisted source of membership truth.

Participation modules and shared consumers may use those membership facts, but they do not persist competing membership state of their own.

A module may persist that a Guildie or Character participated in a module-owned procedure. That is procedure-specific historical meaning, not a replacement for current global membership.

Therefore:

```text
current Character membership
    → reference global Blizzard roster observation

current Guildie organizational membership
    → derive from global control + roster truth

module participation
    → persist only the module-specific participation relationship
```

A module must not copy a current membership fact into local state and later treat that copy as authoritative. It must not reinterpret absence or presence in module storage as guild membership, and it must not overrule globally established current membership or rank facts.

If a procedure needs a historical statement such as "this Character participated while eligible," it may persist the procedure-specific historical fact it actually owns. That historical record does not become a mutable membership source and does not alter current global membership truth.

## Global operational and security persistence

Some globally owned persistence exists to operate the application rather than to represent a member or participation fact.

Current examples include:

```text
authentication attempts
application sessions
Discord association attempts
Character presentation acquisition state
```

These records remain globally owned because they operate shared application ceremonies or acquisition machinery.

They must not be mistaken for additional member objects or participation history.

## Module-owned persistence

A participation module owns the durable facts created by its concrete guild procedure.

Raffle is the current example. Its module-owned state includes facts such as:

```text
raffle rounds
claims
claim resolutions
administrative actor attribution
draw results
raffle-specific historical provenance
```

Module persistence may reference globally owned Guildies, Characters, guilds, ranks, or other application coordinates. Referencing a global object does not transfer ownership of that object to the module.

The rule is:

> A module owns the persistence of the participation truth it establishes. It does not duplicate persistence owned globally by Guild Operations.

## Shared-contract persistence

Some persistence belongs to shared infrastructure even though the truth represented there originates elsewhere.

The Guild Event Calendar is the current earned example.

```text
module
    owns ceremony-specific truth
        ↓ establishes
Guild Event Calendar Listing
        ↓ persisted by
Guild Event Calendar Registry
        ↓ read by
calendar consumer
```

The calendar owns storage and enforcement of the shared Guild Event Calendar Listing contract.

The producing module remains authoritative for whether the concrete occurrence belongs on the calendar and for the calendar listing facts it establishes. Persisting the listing in shared calendar infrastructure does not transfer ownership of the module's procedure, ceremony-specific truth, informational surfaces, administrative surfaces, or history to the calendar.

Therefore:

```text
storage owner
    shared Guild Event Calendar infrastructure

truth origin
    appropriate participation module

consumer
    calendar projection or integration
```

Shared storage and truth origin are intentionally separate concepts.

## External authority versus local persistence ownership

Persistence ownership does not imply authority over facts another system owns.

Blizzard remains authoritative for facts such as:

- authenticated Blizzard account control;
- WoW account structure;
- Character identity and current Character data;
- current WoW guild roster membership;
- numeric guild rank.

Guild Operations may persist observations of those facts because they are needed to operate the guild organization outside WoW. Persisting an observation does not make Guild Operations authoritative for the underlying Blizzard fact.

Guild Operations is authoritative for facts and meanings it establishes itself, including Guildie continuity, selected-main preference, Discord association, globally defined permissions for globally owned operations, shared calendar infrastructure state, and module-owned participation outcomes.

## Persist actual objects and relationships

Global persistence must name the actual object and relationship involved.

Examples:

```text
guildie_id
character_record_id
guild_id
round_id
claim_id
guild_event_id
```

Role-specific relationships should likewise be explicit:

```text
created_by_guildie_id
claimant_guildie_id
approved_by_guildie_id
```

`Subject` is contextual language, not a persisted object category or universal coordinate.

## Persistence laws

Module-owned, globally owned, and shared-contract persistence are all subject to application-wide persistence conventions.

### Time

Persisted time values must use Unix time. Human-readable date and time formatting belongs to presentation.

The server's local timezone is not application policy. Local user input must be converted to the application's persisted Unix representation before storage.

The current schema predates this rule in several global and raffle tables and still contains legacy `timestamptz` columns. Those columns are conformity debt; their existence does not weaken the rule for new persistence.

Do not broaden unrelated feature work into a wholesale timestamp migration merely to remove that debt. Correct it deliberately when a concrete migration scope is earned.

## Ownership test for new persistence

When adding durable state, ask in this order:

1. What concrete fact or relationship is being persisted?
2. Which layer owns the meaning of that fact?
3. Is the fact authoritative locally, or merely an observation of an external authority?
4. Does a global object or membership fact already exist that the new state should reference rather than duplicate?
5. Is shared storage needed because multiple producers and consumers have already earned one contract?

The answer should place the state with its real semantic owner rather than with whichever code path happens to write it first.

## Current boundary summary

```text
Guild Operations global persistence
├── Guildie continuity and Blizzard authority observations
├── controlled Character observations
├── Guild and current Blizzard roster/rank observations
├── derived current Guildie organizational membership
├── globally owned authority and permission state
├── selected-main preference
├── Discord association
├── shared authentication/session/acquisition state
└── other application-wide operational facts

Participation module persistence
└── concrete procedure-specific truth and history

Shared-contract persistence
└── common infrastructure contract state whose truth may originate in modules
```

The database may physically contain all three. Their semantic ownership remains distinct.
