# Guildie Persistence Root

## Purpose

Define the smallest durable persistence contract needed to establish or resolve a Guildie from successful Blizzard authentication.

This document describes domain records and invariants rather than choosing a database or ORM.

## No persisted Subject object

Guild Operations does not persist a generic `Subject` object.

**Subject** is contextual language: it designates whichever already-existing object is the subject of a particular relation, question, statement, or operation. It is therefore not a stable domain type and must not be used as a generic persistence coordinate.

The object the original persistence draft called `GuildSubject` proved through implementation to be **Guildie**.

## Guildie continuity

Guild Operations owns a durable `guildie_id` for each known Guildie.

A Guildie is the durable real-world guild organizational member: the Blizzard account holder and control representative for the Characters they control.

Conceptually:

```text
Guildie
├── guildie_id                 Guild Operations continuity coordinate
├── BlizzardPrincipal         establishment / resolution authority
├── WoWAccount[]              Blizzard-authoritative subordinate accounts
├── Character[]               Blizzard-authoritative controlled characters
├── selected main             mutable presentation preference
└── optional Discord identity resolver
```

The Guildie coordinate lets organizational continuity survive mutable character presentation, selected-main changes, and optional Discord association without inventing a universal identity object.

## Blizzard principal coordinate

A Guildie is established or resolved through a Blizzard-authenticated principal that successfully yields a WoW Account Profile for the selected region.

The durable external coordinate is:

```text
(region, blizzard_principal_id)
```

Guild Operations stores the principal identifier as an opaque Blizzard coordinate. It must not be treated arithmetically or replaced by mutable presentation fields.

The `(region, blizzard_principal_id)` coordinate must resolve to at most one Guildie.

Successful Battle.net authentication alone is insufficient to establish a Guildie. Establishment requires successful acquisition of the regional WoW Account Profile under the granted `wow.profile` authority.

## WoW account records

`wow_accounts[]` are subordinate Blizzard-authoritative records associated with the Guildie.

Each record needs, semantically:

```text
WoWAccount
├── guildie_id
├── region
└── wow_account_id
```

A Guildie may have more than one WoW account. A WoW account is observed account structure; it is not the canonical Guildie object.

## Character records

A **Character** is a durable WoW object and the member object of Blizzard's guild organization.

A Character revealed through account authority is associated with the Guildie that currently demonstrates control of it.

The durable Blizzard coordinate is:

```text
(region, realm_id, character_id)
```

Each persisted controlled Character needs, semantically:

```text
Character
├── guildie_id                 current demonstrated control relationship
├── wow_account_id
├── region
├── realm_id
├── character_id
└── current presentation data
```

Character name and realm presentation are recognition fields, not continuity anchors. Renaming a Character must update current presentation without creating a new Guildie or rewriting historical participation.

The `(region, realm_id, character_id)` coordinate must uniquely identify a persisted Character.

## Selected main

A selected main is mutable Guildie presentation state, not identity or authorization.

Changing the selected main:

- must not create a new Guildie;
- must not change Blizzard account authority;
- must not rewrite historical participation;
- must only alter which eligible controlled Character the Guildie prefers as their presentation surface.

The implementation must guarantee that a Guildie cannot select another Guildie's controlled Character as their main.

## Establish-or-resolve ceremony

Given a completed Blizzard OAuth ceremony:

```text
1. Validate the OAuth callback state.
2. Exchange the authorization code for a user token.
3. Acquire the authenticated Blizzard principal.
4. Acquire `/profile/user/wow` for the selected region.
5. Confirm the profile principal matches the authenticated principal.
6. Resolve `(region, blizzard_principal_id)`.
7. If absent, create one Guildie.
8. Reconcile subordinate WoW accounts and controlled Characters.
9. Establish an application session referencing `guildie_id`.
```

Steps 3-5 are authority-bearing. Provider failure, malformed response, missing scope, or principal mismatch must fail the ceremony rather than being interpreted as a new or absent Guildie.

Repeated successful authentication for the same coordinate must resolve the existing Guildie.

## Reconciliation semantics

Authentication is also an opportunity to refresh Blizzard-authoritative account-control observations for the Guildie.

Reconciliation may discover or refresh WoW accounts, controlled Characters, and mutable Character presentation.

Reconciliation must not silently erase historical guild facts merely because an account or Character disappears from a later Blizzard response. Current control, current guild membership, and historical participation are different facts.

## Character roster and Guildie participation

Blizzard separately owns the current WoW guild Character roster and each roster Character's numeric rank.

Guild Operations derives current Guildie organizational participation from:

```text
Guildie's currently controlled Characters
                ∩
current Blizzard Character roster
                ↓
current Guildie organizational participation
```

The Guildie remains durable even when that intersection is empty.

## Historical references

Operational persistence must reference the object that actually owns or participated in the fact.

Examples:

```text
Guildie actor attribution
└── guildie_id

Raffle claim
├── claimant_guildie_id       Guildie authority/ownership of the claim
└── character_record_id       participating WoW Character

Raffle round administration
└── created_by_guildie_id / live_by_guildie_id / ...
```

Do not replace these role-specific coordinates with a generic `subject_id`.

## Discord boundary

Discord remains outside Guildie establishment.

A Discord association resolves to an already-existing `guildie_id`. Losing, replacing, or unlinking Discord must not affect Blizzard account authority, controlled Characters, or historical guild participation.

## Minimum invariants

1. Every persisted Guildie has one durable `guildie_id`.
2. `(region, blizzard_principal_id)` resolves to at most one Guildie.
3. Battle.net authentication does not establish a Guildie without successful regional WoW profile acquisition.
4. A Guildie may control multiple WoW accounts and Characters.
5. A WoW account belongs to exactly one Guildie within the observed regional coordinate.
6. `(region, realm_id, character_id)` resolves to at most one persisted Character.
7. Every controlled Character belongs to one observed WoW account and resolves through one Guildie control relationship at a time.
8. A selected main, when present, must be an eligible Character controlled by that Guildie.
9. Reauthentication of the same Blizzard coordinate resolves the existing Guildie.
10. Discord cannot establish a Guildie.
11. Mutable presentation fields never serve as continuity anchors.
12. Refreshing current Blizzard state must not rewrite historical guild activity.
13. `Subject` is never a persisted entity category or universal domain coordinate.
