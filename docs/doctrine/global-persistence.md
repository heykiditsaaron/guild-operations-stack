# Persistence Ownership

## Purpose

This document defines how Guild Operations decides **where durable state belongs**. It is doctrine, not a table catalog, migration inventory, or database-access manual.

> Persistence ownership follows semantic ownership.

A fact is not globally owned merely because it is stored in the same database, referenced by many consumers, or projected through a shared interface.

## Global state

Guild Operations globally owns durable application objects and shared operational facts whose meaning belongs to the application as a whole, including Guildie continuity, Guild Operations-owned preferences and associations, global permission policy, and persistence required by genuinely shared infrastructure.

Blizzard observations needed globally may also be persisted globally without transferring authority away from Blizzard.

Concrete modules reference globally owned objects and observations rather than recreating them locally.

## Derived state

Not every globally meaningful fact should be independently persisted.

Current Guildie organizational participation and effective rank are derived from account-control and roster observations according to [`guild-authority.md`](guild-authority.md). They must not become a second stored source of membership authority.

Historical procedure facts may be persisted by the procedure that established them without becoming mutable sources of current membership, rank, or identity truth.

## Module-owned persistence

A concrete module owns durable facts created by its own guild procedure.

> A module owns the persistence of the participation or operation truth it establishes. It does not duplicate persistence owned globally by Guild Operations.

Referencing a Guildie, Character, guild, rank, capability, or other global coordinate does not transfer ownership of that object or authority fact to the module.

## Shared-contract persistence

Shared infrastructure may own storage and enforcement of a shared contract even when another owner remains authoritative for the truth contributed through it.

For example, a module may own the occurrence truth that it translates into a Guild Event Calendar Listing while Calendar infrastructure owns storage and enforcement of the listing contract.

Shared storage and semantic truth ownership are separate concepts.

## External authority

Persisting an observation does not transfer authority from the system that established it.

Blizzard remains authoritative for authenticated account control, WoW account structure, Character identity and observations, current WoW guild roster membership, and numeric guild rank.

Guild Operations is authoritative for meanings and procedures it establishes itself.

## Persist actual objects and relationships

Persistence must name the actual object and relationship involved. `Subject` is contextual language, not a persisted object category or universal coordinate.

## Time law

Persisted values representing instants in time use Unix time. Human-readable formatting belongs to presentation. Server or container timezone is not application policy, and local user input must be converted before persistence.

Legacy timestamp columns predating this rule are conformity debt; they do not weaken the rule for new persistence and should not trigger unrelated wholesale migrations.

## Ownership test

When adding durable state, ask:

1. What concrete fact or relationship is being persisted?
2. Which layer owns the meaning of that fact?
3. Is it locally authoritative or an observation of external authority?
4. Does globally owned state already exist that should be referenced rather than duplicated?
5. Has shared storage actually been earned by real producers or consumers?

Place state with its semantic owner rather than whichever code path happens to write it first.

Current transactional and operational persistence mechanics belong under [`../infrastructure/`](../infrastructure/).
