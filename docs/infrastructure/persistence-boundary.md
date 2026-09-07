# Persistence Boundary

## Purpose

Define the transactional persistence behavior that admits Blizzard account authority into existing Guild Operations member continuity without allowing storage mechanics to redefine the domain.

Member object meanings are defined in [`member-objects.md`](member-objects.md). Global persistence ownership is defined in [`global-persistence.md`](global-persistence.md). This document owns the narrower question:

> How does corroborated Blizzard account/control authority establish or reconcile persisted Guildie state safely?

Timestamp-like fields shown here inherit the application-wide Unix persistence convention. Existing legacy timestamp columns remain conformity debt where documented.

## Persisted slice

The Blizzard-authenticated persistence slice operates over these existing domain objects:

```text
Guildie
BlizzardPrincipalBinding
WoWAccount
Character
```

Authentication attempts and application sessions are operational/security persistence, not additional member objects.

There is no persisted `Subject` object or universal `subject_id` coordinate.

## Persistence coordinates

The durable Guild Operations member coordinate is:

```text
guildie_id
```

The Blizzard principal binding is:

```text
region + blizzard_principal_id
```

and must resolve to at most one Guildie.

A WoW account is subordinate observed account structure associated with one Guildie in the regional coordinate.

The durable Character coordinate is:

```text
region + realm_id + character_id
```

Mutable Character presentation does not participate in continuity uniqueness.

Current Character control and current guild-roster membership remain separate Blizzard observations. This persistence boundary owns the account/control side only.

## Shared account/control reconciliation

Given an already selected Guildie and a fresh corroborated Blizzard WoW account profile, account/control reconciliation atomically:

```text
1. marks previously controlled Characters for the Guildie/region as not currently controlled
2. reconciles returned WoW accounts under that Guildie
3. reconciles returned Characters and marks them currently controlled
4. refreshes mutable account/Character observations
5. commits the complete account/control projection
```

The newest successful observation is authoritative for current control within that Guildie/region scope.

A Character omitted from the newest account observation may cease to be currently controlled, but the durable Character and historical facts are preserved.

Positive contradictory ownership fails closed. A WoW account or Character coordinate already associated with another Guildie is not silently reparented.

## Establishment-capable login

Ordinary Blizzard login may establish Guildie continuity.

The persistence boundary exposes behavior equivalent to:

```text
establishOrResolveGuildie(
    region,
    blizzardPrincipalId,
    wowProfileProjection
) -> guildie_id
```

The caller has already completed OAuth validation, Blizzard authority acquisition, regional WoW profile acquisition, and principal corroboration.

Atomically:

```text
1. resolve or create Guildie for (region, blizzard_principal_id)
2. confirm/update the Blizzard principal binding observation
3. perform shared account/control reconciliation for that Guildie
4. commit
5. return guildie_id
```

No successful `guildie_id` is returned from a partially committed projection.

The authentication ceremony that owns this establishment power is documented in [`authentication-ceremony.md`](authentication-ceremony.md).

## Existing-Guildie reconciliation

A ceremony that already has established Guildie continuity must not reuse establishment authority merely because it needs the same account/control mechanics.

Self account refresh therefore uses behavior equivalent to:

```text
reconcileExistingGuildieBlizzardObservation(
    guildie_id,
    region,
    blizzardPrincipalId,
    wowProfileProjection
)
```

This boundary requires the exact `(guildie_id, region, blizzard_principal_id)` binding to already exist before account/control mutation begins.

It cannot create a Guildie or establish a new Blizzard principal binding. A mismatch fails before reconciliation.

The self-refresh ceremony is documented in [`self-account-refresh.md`](self-account-refresh.md).

## Why these paths remain separate

Both ceremonies need the same account/control reconciliation mechanics, but they do not possess the same authority.

```text
ordinary login
    may establish or resolve Guildie continuity
        ↓
shared account/control reconciliation

self refresh
    must already possess exact Guildie/principal continuity
        ↓
shared account/control reconciliation
```

Sharing reconciliation therefore does not imply sharing establishment power.

## Concurrency and uniqueness

Application pre-checks are insufficient. Persistence uniqueness must ensure that concurrent successful ceremonies for the same Blizzard principal ultimately resolve the same Guildie rather than create duplicates.

Equivalent duplicate protection applies to WoW account and Character coordinates.

## Transaction boundary

External Blizzard network work happens outside the persistence transaction.

For establishment-capable login:

```text
outside transaction
    validate OAuth ceremony
    acquire Blizzard authority
    acquire WoW profile
    corroborate principal

inside transaction
    establish/resolve Guildie
    persist principal observation
    reconcile accounts/control

commit
    ↓
application session may be issued
```

For existing-Guildie self refresh:

```text
outside transaction
    validate existing session and self-refresh ceremony
    acquire Blizzard authority
    acquire WoW profile
    corroborate principal against current Guildie

inside transaction
    require exact existing Guildie/principal binding
    reconcile accounts/control

commit
    ↓
eligible Character presentation acquisition may proceed
```

Provider latency and failure do not belong inside the account/control transaction.

Character profile/media acquisition is also outside that transaction. Presentation failure does not invalidate successfully committed account/control truth and cannot establish Guild Operations eligibility.

## Absence and history

A later Blizzard response omitting an account or Character does not imply that the durable object never existed or is safe to delete.

Current control, current guild membership, and historical participation are distinct facts.

Account reconciliation may change current-control state while preserving durable objects and historical references. Destructive transfer or retirement semantics require their own earned procedure.

## Persistence does not decide

This boundary does not decide:

- whether Blizzard OAuth succeeded;
- whether a provider response is trustworthy;
- which controlled Characters are current guild members;
- which Character is eligible or selected as main;
- whether a Guildie is authorized for an operation;
- whether Discord should be associated; or
- what Character presentation can currently be acquired.

Those decisions remain with their actual authority or procedure owners.

In particular, account/control persistence may observe Characters outside the current guild roster. Guild Operations eligibility is derived elsewhere from current control ∩ current roster.

## Minimum invariants

1. `guildie_id` is Guild Operations-owned and stable.
2. `(region, blizzard_principal_id)` resolves to at most one Guildie.
3. Establish-or-resolve is atomic and concurrency-safe.
4. Existing-Guildie reconciliation cannot establish a new Guildie or principal binding.
5. A Guildie may have multiple WoW accounts and controlled Characters.
6. A WoW account coordinate belongs to at most one Guildie.
7. `(region, realm_id, character_id)` resolves to at most one Character.
8. Positive contradictory ownership fails closed rather than silently reparenting.
9. Mutable presentation never participates in continuity identity.
10. Omission from a later account observation may end current control but does not delete durable objects or historical truth.
11. No application session is issued until establishment/reconciliation commits.
12. External Blizzard HTTP calls occur outside the transaction.
13. Character presentation acquisition occurs outside account/control persistence and cannot establish eligibility.
14. `Subject` is not persisted as an object or coordinate.
