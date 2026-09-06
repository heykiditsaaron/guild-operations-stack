# Global Persistence

## Purpose

Define which durable state belongs to Guild Operations globally so shared machinery and concrete modules can orient against one operational truth without duplicating it.

This document owns persistence **semantics and ownership**. It is not a table-by-table schema catalog, migration inventory, or generic persistence framework.

> Persistence ownership follows semantic ownership.

A fact is not globally owned merely because it is stored in the same database, referenced by many consumers, or projected through a shared interface.

## Globally owned persisted state

Guild Operations globally persists durable application objects and shared operational facts whose meaning belongs to the application as a whole.

Current examples include:

```text
Guildie continuity
Blizzard principal bindings
WoW account observations
Character control observations
Guild identity and Blizzard roster observations
Blizzard numeric rank observations
Guild Operations rank definitions and global capabilities
selected-main preference
Discord association
authentication/session state
Character presentation acquisition state
```

These facts are not recreated inside concrete participation modules.

Modules may reference globally owned coordinates while persisting procedure-specific meaning. Referencing a Guildie, Character, guild, rank, or other global coordinate does not transfer ownership of that object or authority fact to the module.

## Derived global state

Not every globally meaningful state is independently persisted.

Current Guildie organizational participation is derived from shared Blizzard observations:

```text
Guildie's currently controlled Characters
                ∩
current Blizzard guild Character roster
                ↓
current Guildie participation surface
        +
effective guild rank
```

The persisted inputs are global observations. The resulting Guildie participation surface and effective rank are derived current truth, not a second stored membership authority.

The derivation itself is defined in [`guild-authority.md`](guild-authority.md).

## Membership references

Current Character membership comes from the persisted Blizzard roster observation. Current Guildie organizational participation is derived from control + roster truth.

Therefore:

```text
current Character membership
    → reference the global Blizzard roster observation

current Guildie organizational participation
    → derive from global control + roster observations

procedure-specific participation
    → persist only the historical/procedural relationship actually established
```

A module or shared consumer must not copy current membership into local state and later treat that copy as authoritative.

A historical statement such as "this Character participated while eligible" may be persisted by the procedure that owns that fact. Historical participation does not become a mutable source of current guild membership or rank.

## Shared authority state

Guild Operations persists or derives the shared facts from which authorization is evaluated.

Current authority inputs include:

- authenticated Guildie continuity;
- Blizzard-demonstrated Character control;
- current Blizzard guild roster membership;
- current Blizzard numeric guild rank;
- Guild Operations-owned global capability policy.

The translation from effective guild authority into globally owned application permission is documented in [`guild-permissioning.md`](guild-permissioning.md).

Consumers should reference these shared facts rather than duplicating them merely to make a local authorization decision.

## Operational and security persistence

Some globally owned persistence operates shared ceremonies rather than representing a member or participation fact.

Examples include:

```text
authentication attempts
application sessions
Discord association attempts
Character presentation acquisition attempts/state
```

These records are application machinery. They are not additional member objects or participation history.

## Module-owned persistence

A concrete module owns the durable facts created by its own guild procedure.

The rule is:

> A module owns the persistence of the participation or operation truth it establishes. It does not duplicate persistence owned globally by Guild Operations.

Module persistence may reference global objects and current authority facts. It must not become a competing owner of those facts.

## Shared-contract persistence

Some persistence belongs to shared infrastructure even when the truth represented there originates in another owner.

The Guild Event Calendar is the current earned example:

```text
module
    owns occurrence truth
        ↓ establishes
Guild Event Calendar Listing
        ↓ stored/enforced by
Guild Event Calendar Registry
        ↓ read by
calendar consumers
```

The shared infrastructure owns storage and enforcement of its contract. The producing module remains authoritative for the concrete occurrence facts it contributes.

Shared storage and truth origin are intentionally separate concepts.

## External authority versus persistence ownership

Persisting an observation does not transfer authority from the external system that established it.

Blizzard remains authoritative for facts such as:

- authenticated Blizzard account control;
- WoW account structure;
- Character identity and Blizzard-owned Character observations;
- current WoW guild roster membership;
- numeric guild rank.

Guild Operations persists those observations because they are needed to operate the guild outside WoW. It remains authoritative only for the meanings and procedures it establishes itself, including Guildie continuity, selected-main preference, Discord association, application permission policy, shared-contract state, and concrete Guild Operations procedure outcomes.

## Persist actual objects and relationships

Persistence must name the actual object and relationship involved.

Examples include:

```text
guildie_id
character_record_id
guild_id
guild_event_id
```

Role-specific relationships should be equally explicit.

`Subject` is contextual language, not a persisted object category or universal coordinate.

## Persistence laws

Global, module-owned, and shared-contract persistence are all subject to application-wide persistence conventions.

### Time

Persisted values representing instants in time must use Unix time. Human-readable date and time formatting belongs to presentation.

Server or container timezone is not application policy. Local user input must be converted to canonical Unix representation before persistence.

The current schema predates this rule in several places and still contains legacy `timestamptz` columns. Those columns are conformity debt; their existence does not weaken the rule for new persistence.

Do not broaden unrelated feature work into a wholesale timestamp migration merely to remove that debt. Correct it deliberately when a concrete migration scope is earned.

## Ownership test for new persistence

When adding durable state, ask:

1. What concrete fact or relationship is being persisted?
2. Which layer owns the meaning of that fact?
3. Is the fact locally authoritative or an observation of external authority?
4. Does globally owned state already exist that should be referenced rather than duplicated?
5. Has shared storage actually been earned by multiple producers or consumers?

The answer should place state with its semantic owner rather than with whichever code path happens to write it first.

## Current boundary summary

```text
Guild Operations global state
├── persisted durable objects and external-authority observations
│   ├── Guildie / Blizzard account-control observations
│   ├── Character / guild roster / numeric-rank observations
│   ├── selected main and Discord association
│   ├── global permission policy
│   └── shared operational/security acquisition state
├── derived current state
│   └── Guildie participation surface + effective rank
└── shared-contract persisted state
    └── common infrastructure contracts whose truth may originate elsewhere

Module-owned persistence
└── concrete procedure-specific truth and history
```

The database may physically contain records from all of these ownership classes. Their semantic ownership remains distinct.
