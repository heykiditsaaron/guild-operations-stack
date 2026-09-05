# Persistence Boundary

## Purpose

Define the persistence behavior required to establish and preserve Guildie continuity from Blizzard account authority without allowing storage mechanics to redefine the domain.

This document is deliberately narrower than the application's complete global persistence model.

## Persisted objects

The root Blizzard-authenticated persistence slice contains:

```text
Guildie
BlizzardPrincipalBinding
WoWAccount
Character
```

Authentication attempts and application sessions are persisted operational/security state, not additional member objects.

There is no persisted `Subject` object. **Subject** is contextual language for an already-existing object in relation to a question or operation; it is not a domain type or persistence coordinate.

## Guildie

`Guildie` is the durable Guild Operations representation of the real-world guild organizational member and the account-holder/control representative for their Characters.

Minimum semantics:

```text
Guildie
├── guildie_id
├── created_at
└── updated_at
```

`guildie_id` is generated and owned by Guild Operations. It is the durable coordinate used when a fact genuinely belongs to the Guildie.

Do not replace role-specific object coordinates in participation records with a generic identity coordinate merely because the Guildie is involved.

## Blizzard principal binding

The Blizzard principal coordinate is the authority-bearing external binding that establishes and resolves a Guildie.

```text
BlizzardPrincipalBinding
├── guildie_id
├── region
├── blizzard_principal_id
├── first_observed_at
└── last_confirmed_at
```

The pair `(region, blizzard_principal_id)` must be unique and resolve to at most one Guildie.

The principal identifier is opaque. It is not a presentation field and must not be assigned numeric meaning.

## WoW account

Each Blizzard-returned WoW account is persisted as observed account structure associated with the Guildie.

```text
WoWAccount
├── guildie_id
├── region
├── wow_account_id
├── first_observed_at
└── last_observed_at
```

A Guildie may have multiple WoW accounts. A WoW account coordinate belongs to at most one Guildie within the observed regional coordinate.

## Character

Each Character returned beneath a WoW account is persisted as a durable WoW object with mutable presentation and a currently demonstrated Guildie-control relationship.

```text
Character
├── guildie_id
├── wow_account_id
├── region
├── realm_id
├── character_id
├── current presentation
├── first_observed_at
└── last_observed_at
```

The durable Character coordinate is `(region, realm_id, character_id)`.

Character name and other mutable presentation fields do not participate in continuity uniqueness.

Character is also the member object of Blizzard's guild organization. Blizzard's current guild roster is a separate authority-bearing observation from the account-control relationship represented here.

## Selected main

Selected main is mutable Guildie presentation state. It is not required to complete authentication and does not establish Guildie continuity, Character control, current guild participation, or authority.

When stored, it references an eligible Character controlled by the same Guildie.

## Atomic establish-or-resolve

The persistence boundary exposes behavior equivalent to:

```text
establishOrResolveGuildie(
    region,
    blizzardPrincipalId,
    wowProfileProjection
) -> guildie_id
```

The caller has already completed provider authorization, profile acquisition, and principal corroboration.

Atomically:

```text
1. resolve or create Guildie for (region, blizzard_principal_id)
2. confirm/update Blizzard principal observation
3. reconcile returned WoW accounts for that Guildie
4. reconcile returned controlled Characters
5. commit the complete projection
6. return guildie_id
```

No successful `guildie_id` is returned from a partially committed projection.

## Concurrency and uniqueness

Application pre-checks are insufficient. Persistence must enforce uniqueness on the Blizzard principal coordinate so concurrent successful callbacks ultimately resolve the same Guildie rather than create duplicates.

Equivalent duplicate protection applies to WoW account and Character coordinates.

## Reconciliation

The Blizzard Account Profile response is authoritative for what it positively asserts during that ceremony.

Reconciliation may create newly observed accounts/Characters, refresh observation timestamps and mutable presentation, and confirm returned parent-child relationships.

Positive contradictory ownership is not an ordinary refresh. If a persisted WoW account or Character coordinate is already associated with another Guildie, the transaction fails closed rather than silently reparenting it.

## Absence is not deletion

A later Blizzard response omitting an account or Character does not imply it never existed, is safe to delete, or should disappear from historical participation.

Current observation/control and historical truth are different concerns. Reconciliation remains non-destructive unless a later concrete workflow earns explicit transfer or retirement semantics.

## Transaction boundary

External Blizzard acquisition and corroboration happen before the database transaction.

```text
outside transaction
    validate OAuth ceremony
    acquire Blizzard authority
    acquire WoW profile
    corroborate principal

inside transaction
    establish/resolve Guildie
    persist principal observation
    reconcile accounts
    reconcile controlled Characters

commit
    ↓
guildie_id may be used to create application session
```

Provider latency and failure do not belong inside the persistence transaction.

## Participation references

Persistence must name the actual object and role involved.

Examples:

```text
application session
    guildie_id

selected main
    guildie_id + Character coordinate

raffle administrative actor
    created_by_guildie_id

raffle claimant
    claimant_guildie_id

raffle participating member
    character_record_id
```

A generic `subject_id` must not be introduced as a shortcut across these different relations.

## What persistence does not decide

Persistence does not decide whether Blizzard OAuth succeeded, whether provider responses are trustworthy, whether a Guildie is authorized for an operation, which Character should be selected as main, or whether Discord should be associated. Those decisions belong to their actual authority/procedure owners.

## Minimum invariants

1. `guildie_id` is Guild Operations-owned and stable.
2. `(region, blizzard_principal_id)` resolves to at most one Guildie.
3. Establish-or-resolve is atomic and concurrency-safe.
4. A Guildie may have multiple WoW accounts and controlled Characters.
5. A WoW account coordinate belongs to at most one Guildie.
6. `(region, realm_id, character_id)` resolves to at most one Character.
7. Positive contradictory control/ownership fails closed rather than silently reparenting.
8. Mutable presentation never participates in continuity identity.
9. Omission from a later Blizzard response does not delete durable objects or historical truth.
10. No session is issued until the complete Guildie establishment/reconciliation transaction commits.
11. External Blizzard HTTP calls occur outside that transaction.
12. `Subject` is not persisted as an object or coordinate.
