# Blizzard Account Persistence Boundary

## Purpose

This document describes the current transactional machinery that persists corroborated Blizzard account/control observations for Guildies.

Domain meanings come from [`../doctrine/member-objects.md`](../doctrine/member-objects.md). Persistence ownership comes from [`../doctrine/global-persistence.md`](../doctrine/global-persistence.md).

This infrastructure answers:

> How does corroborated Blizzard account/control authority establish or reconcile persisted Guildie state safely?

## Persisted slice

The boundary operates over:

```text
Guildie
BlizzardPrincipalBinding
WoWAccount
Character
```

The durable coordinates are:

```text
guildie_id
region + blizzard_principal_id
region + realm_id + character_id
```

Current Character control and current guild-roster membership remain separate observations. This boundary owns account/control persistence only.

## Shared reconciliation

Given an already selected Guildie and a fresh corroborated Blizzard WoW account profile, account/control reconciliation atomically:

```text
1. marks previously controlled Characters for the Guildie/region as not currently controlled
2. reconciles returned WoW accounts under that Guildie
3. reconciles returned Characters and marks them currently controlled
4. refreshes mutable account/Character observations
5. commits the complete account/control projection
```

The newest successful observation is authoritative for current control within that Guildie/region scope.

Omission may end current control but does not delete the durable Character or historical facts. Contradictory positive ownership fails closed rather than silently reparenting objects.

## Establishment-capable login

Ordinary Blizzard login uses behavior equivalent to:

```text
establishOrResolveGuildie(
    region,
    blizzardPrincipalId,
    wowProfileProjection
) -> guildie_id
```

The caller must already have completed OAuth validation, Blizzard authority acquisition, regional WoW profile acquisition, and principal corroboration.

Inside one transaction the boundary resolves or creates the Guildie, confirms the principal binding, performs shared account/control reconciliation, commits, and returns `guildie_id`.

The calling ceremony is documented in [`authentication-ceremony.md`](authentication-ceremony.md).

## Existing-Guildie reconciliation

Self refresh uses behavior equivalent to:

```text
reconcileExistingGuildieBlizzardObservation(
    guildie_id,
    region,
    blizzardPrincipalId,
    wowProfileProjection
)
```

The exact `(guildie_id, region, blizzard_principal_id)` binding must already exist before mutation begins. This path cannot create a Guildie or establish a new Blizzard principal binding.

The calling ceremony is documented in [`self-account-refresh.md`](self-account-refresh.md).

Both paths reuse account/control reconciliation mechanics without sharing establishment authority.

## Transaction boundary

External Blizzard network work occurs outside the persistence transaction.

For ordinary login:

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

For self refresh:

```text
outside transaction
    validate session and refresh ceremony
    acquire Blizzard authority
    acquire WoW profile
    corroborate principal against current Guildie

inside transaction
    require exact existing binding
    reconcile accounts/control

commit
    ↓
eligible Character presentation acquisition may proceed
```

Character profile/media acquisition remains outside this transaction. Presentation failure cannot invalidate committed account/control truth or establish eligibility.

## Concurrency and uniqueness

Persistence uniqueness must ensure concurrent successful ceremonies for the same Blizzard principal resolve the same Guildie. Equivalent duplicate protection applies to WoW account and Character coordinates.

## Operational invariants

1. `guildie_id` is stable and Guild Operations-owned.
2. `(region, blizzard_principal_id)` resolves to at most one Guildie.
3. Establish-or-resolve is atomic and concurrency-safe.
4. Existing-Guildie reconciliation cannot establish new continuity.
5. A WoW account coordinate belongs to at most one Guildie.
6. `(region, realm_id, character_id)` resolves to at most one Character.
7. Positive contradictory ownership fails closed.
8. Mutable presentation never participates in continuity identity.
9. Omission may end current control but does not erase durable objects or history.
10. No application session is issued before persistence commits.
11. External Blizzard HTTP calls occur outside the transaction.
12. Character presentation acquisition occurs outside account/control persistence and cannot establish eligibility.

New persisted instants inherit the repository-wide Unix persistence doctrine.
