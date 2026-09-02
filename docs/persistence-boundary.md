# Persistence Boundary

## Purpose

Define the minimum persistence behavior required to support the Blizzard authentication ceremony without committing the project to a database engine, ORM, or framework.

This boundary exists so application code can depend on domain operations rather than on storage mechanics.

## Required persisted records

The first executable identity slice requires four persisted concepts:

```text
GuildSubject
BlizzardPrincipalBinding
WoWAccount
Character
```

Authentication-attempt and application-session persistence are separate security/session concerns. They may use the same storage system later, but they are not part of the durable identity aggregate defined here.

## GuildSubject

`GuildSubject` is the canonical internal continuity object.

Minimum semantics:

```text
GuildSubject
├── subject_id
├── created_at
└── updated_at
```

`subject_id` is generated and owned by Guild Operations. It is the identifier referenced by future guild operations such as raffles, Hidden in Plain Sight, raids, rewards, permissions, and Discord linking.

A GuildSubject must not be identified internally by BattleTag, Blizzard principal ID, WoW account ID, character ID, or selected main character.

## BlizzardPrincipalBinding

The Blizzard principal coordinate is modeled explicitly as the authority-bearing external binding that establishes and resolves a GuildSubject.

Minimum semantics:

```text
BlizzardPrincipalBinding
├── subject_id
├── region
├── blizzard_principal_id
├── first_observed_at
└── last_confirmed_at
```

The pair:

```text
(region, blizzard_principal_id)
```

must be unique across the persistence store.

One such coordinate resolves to at most one GuildSubject.

For the initial scope, one GuildSubject has one Blizzard principal binding. This is not a generic provider-identity table and should not be generalized without a concrete requirement.

`blizzard_principal_id` is semantically opaque. Although the live Blizzard response currently exposes numeric and textual representations of the same value, storage code must not perform arithmetic or otherwise assign numeric meaning to it.

## WoWAccount

Each Blizzard-returned `wow_accounts[]` item is persisted as a subordinate record beneath the GuildSubject.

Minimum semantics:

```text
WoWAccount
├── subject_id
├── region
├── wow_account_id
├── first_observed_at
└── last_observed_at
```

Within the selected region, a WoW account coordinate must belong to at most one GuildSubject.

The persistence implementation must permit multiple WoW accounts beneath one GuildSubject even if the first live probe exposed only one.

A WoWAccount is not itself an authentication principal and must never become the application session identity.

## Character

Each character returned beneath a WoW account is persisted as a Blizzard-authoritative subordinate identity with mutable current presentation.

Minimum semantics:

```text
Character
├── subject_id
├── wow_account_id
├── region
├── realm_id
├── character_id
├── current_name
├── current_realm_name
├── current_realm_slug
├── first_observed_at
└── last_observed_at
```

The durable character coordinate is:

```text
(region, realm_id, character_id)
```

That coordinate must resolve to at most one persisted Character.

Name and realm presentation may change and must not participate in continuity uniqueness.

Fields such as level, faction, race, class, and gender may be retained as current presentation when useful to the first interface, but they are not required to establish identity continuity and should not expand the initial persistence boundary unnecessarily.

## Selected main

A selected main is not required to complete authentication and therefore does not belong in the minimum authentication persistence transaction.

When introduced, it must be represented as mutable guild state referencing a Character already owned by the same GuildSubject.

The first vertical slice should not block authentication merely because no main has been selected.

## Atomic establish-or-resolve operation

The persistence boundary must expose one domain operation with semantics equivalent to:

```text
establishOrResolveSubject(
    region,
    blizzardPrincipalId,
    wowProfileProjection
) -> subject_id
```

The caller has already completed provider authorization, profile acquisition, and principal corroboration. Persistence must not re-decide Blizzard authority from raw HTTP responses.

The operation performs, atomically:

```text
1. resolve or create GuildSubject for (region, blizzard_principal_id)
2. confirm/update BlizzardPrincipalBinding.last_confirmed_at
3. reconcile returned WoWAccount records beneath that subject
4. reconcile returned Character records beneath their returned WoW accounts
5. commit the complete identity projection
6. return subject_id
```

If any required persistence or reconciliation step fails, the operation fails as a whole.

The authentication layer must not receive a successful `subject_id` from a partially committed projection.

## Concurrency behavior

Application pre-checks are insufficient to protect canonical identity.

Two callbacks for the same Blizzard coordinate may race. Therefore persistence must enforce uniqueness on:

```text
(region, blizzard_principal_id)
```

and establish-or-resolve must tolerate a concurrent creator.

Conceptually:

```text
attempt A: sees absent ─┐
                       ├─ persistence uniqueness decides one subject
attempt B: sees absent ─┘

both successful callers ultimately resolve the same subject_id
```

A uniqueness conflict produced by this expected race should be converted into resolution of the winning GuildSubject, not into creation of a second subject.

Equivalent duplicate-safety is required for subordinate WoW account and character coordinates.

## Reconciliation rules

The Blizzard Account Profile response is authoritative for what it positively asserts during that ceremony.

For records present in the response, reconciliation may:

- create newly observed WoWAccount records;
- update `last_observed_at` for known WoWAccount records;
- create newly observed Character records;
- update `last_observed_at` for known Character records;
- refresh mutable current character presentation;
- confirm the returned parent-child relationships.

Positive contradictory ownership is not a normal refresh.

If a persisted WoW account or character coordinate is already bound to another GuildSubject, the transaction must fail closed and surface an identity-integrity conflict for investigation. Persistence must not silently reparent the coordinate during authentication.

## Absence is not deletion

A later Blizzard response may omit something seen previously.

The first implementation must interpret omission conservatively:

```text
not present now != never existed
not present now != safe to delete
not present now != historical participation should disappear
```

Therefore reconciliation must not hard-delete WoWAccount or Character records merely because they are absent from the newest profile response.

The initial model may simply leave their previous record intact while not advancing `last_observed_at`.

A later feature may introduce explicit current-visibility state when the product actually needs to distinguish currently observed from historically known identities.

## Parentage integrity

The Account Profile response carries a hierarchy:

```text
principal
└── WoW account
    └── character
```

Persistence must preserve that hierarchy.

For a returned character:

- its WoW account must belong to the resolved GuildSubject;
- its Character record must belong to that same GuildSubject;
- an existing character coordinate bound elsewhere is an integrity failure;
- reconciliation must not silently move it between subjects or accounts.

If Blizzard later demonstrates legitimate transfer behavior that requires reparenting, that behavior must be designed explicitly rather than inferred from an ordinary authentication refresh.

## Transaction boundary

The durable identity transaction begins only after the application has obtained and corroborated Blizzard authority.

Conceptually:

```text
outside transaction
    validate OAuth callback
    exchange code
    acquire userinfo
    acquire WoW profile
    corroborate principal

inside transaction
    establish/resolve subject
    persist principal binding
    reconcile accounts
    reconcile characters

transaction commits
    ↓
subject_id may be used to create application session
```

External Blizzard HTTP calls must not be held open inside the database transaction. Provider latency and provider failure belong outside the persistence transaction.

This keeps the transaction short and ensures its responsibility is limited to applying an already-corroborated authoritative projection.

## Persistence result

A successful operation returns the canonical `subject_id` and may additionally return enough current identity projection for the caller to avoid immediately re-reading it.

The minimum authoritative result is:

```text
subject_id
```

Whether the implementation additionally returns current accounts or characters is an efficiency/API decision, not part of identity semantics.

## Failure categories

Persistence should distinguish at least these semantic failures:

```text
storage unavailable
transaction failed
principal uniqueness/integrity conflict
WoW account ownership conflict
character ownership conflict
invalid projection supplied by caller
```

These all mean the establish-or-resolve operation did not complete.

They must not be translated into "new user," "no subject," or a reason to retry by creating another subject.

## Boundary API

The application-facing persistence contract should remain narrow.

At minimum it needs behavior equivalent to:

```text
establishOrResolveSubject(authoritativeProjection)
    -> subject_id

resolveSubjectById(subject_id)
    -> subject | absent
```

Additional query methods should be added only when an actual interface or guild workflow requires them.

The first implementation should not expose generic CRUD for identity records merely because the storage technology makes CRUD easy.

## What persistence does not own

Persistence does not decide:

- whether Blizzard OAuth succeeded;
- whether OAuth `state` is valid;
- whether the token has `wow.profile` scope;
- whether `/oauth/userinfo` is trustworthy;
- whether `/profile/user/wow` was successfully acquired;
- whether the two Blizzard principal representations corroborate;
- whether a user is authorized to perform guild-officer actions;
- which character should be selected as main;
- whether a Discord identity should be linked.

Those decisions belong to their actual authority boundaries.

## Minimum invariants

1. `subject_id` is Guild Operations-owned and stable.
2. `(region, blizzard_principal_id)` resolves to at most one GuildSubject.
3. Establish-or-resolve is atomic.
4. Concurrent establishment of the same Blizzard coordinate cannot create duplicate subjects.
5. A GuildSubject may have multiple WoW accounts.
6. A WoW account coordinate belongs to at most one GuildSubject.
7. `(region, realm_id, character_id)` resolves to at most one Character.
8. A Character belongs to one WoW account and one GuildSubject.
9. Positive contradictory ownership fails closed rather than silently reparenting identity.
10. Mutable presentation never participates in continuity identity.
11. Omission from a later Blizzard response does not delete durable identity or historical truth.
12. No Guild Operations session is issued until the complete identity transaction commits.
13. External Blizzard HTTP calls occur outside the durable identity transaction.

## Explicitly deferred

The first persistence boundary does not yet decide:

- database engine;
- ORM or query library;
- UUID versus another internal `subject_id` representation;
- exact SQL/collection names;
- timestamp implementation details;
- soft-delete machinery;
- explicit current-visibility flags;
- character-transfer handling;
- selected-main storage;
- Discord identity storage;
- application-session storage;
- authentication-attempt storage;
- audit/event-ledger machinery beyond what concrete guild workflows later require.

The next implementation step may choose concrete technology, but it must preserve this boundary rather than letting storage convenience redefine identity semantics.
