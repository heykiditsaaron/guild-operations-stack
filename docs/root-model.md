# Root Persistence Model

## Purpose

Define the smallest durable persistence contract needed to establish or resolve a Guild Operations subject from successful Blizzard authentication.

This document deliberately describes domain records and invariants rather than choosing a database or ORM.

## Canonical subject

Guild Operations owns an internal canonical subject identifier.

That identifier is the stable reference used by guild operations such as raffles, Hidden in Plain Sight, participation history, permissions, rewards, and later Discord resolution.

It is not a Blizzard identifier and it is not a character identifier.

Conceptually:

```text
GuildSubject
├── subject_id                 internal Guild Operations identity
├── BlizzardPrincipal         establishment / resolution authority
├── WoWAccount[]              Blizzard-authoritative subordinate accounts
├── Character[]               Blizzard-authoritative subordinate characters
├── selected main             mutable guild-facing designation
└── later: Discord identity   resolver only
```

The internal `subject_id` exists so guild history depends on Guild Operations continuity rather than on the continued shape or naming of an external API.

## Blizzard principal coordinate

A subject is established or resolved through a Blizzard-authenticated principal that successfully yields a WoW Account Profile for the selected region.

The durable external coordinate is:

```text
(region, blizzard_principal_id)
```

The live authority probe established that, for the same authenticated principal:

```text
userinfo.id == userinfo.sub == /profile/user/wow.id
```

when compared by value, and that the value remained stable across two independent OAuth ceremonies.

Guild Operations should store one normalized representation of that principal identifier rather than persisting three competing identity fields. The exact storage type may be chosen with the implementation stack; semantically it is an opaque Blizzard identifier and must not be used arithmetically.

The `(region, blizzard_principal_id)` coordinate must be unique among subjects.

Successful Battle.net authentication alone is insufficient to establish a subject. Establishment requires successful acquisition of the regional WoW Account Profile under the granted `wow.profile` authority.

## WoW account records

`wow_accounts[]` are subordinate Blizzard-authoritative records beneath the canonical subject.

Each record needs, semantically:

```text
WoWAccount
├── subject_id
├── region
└── wow_account_id
```

The live probe confirmed that `wow_accounts[].id` is distinct from the authenticated principal identifier and remained stable across repeated authorization.

A subject may have more than one WoW account. The persistence contract must therefore remain one-to-many even though the probe account exposed only one.

A WoW account must never become the canonical guild subject merely because only one currently exists.

## Character records

Characters are subordinate to a WoW account and therefore to the canonical subject.

The durable Blizzard coordinate observed in the Account Profile response is:

```text
(region, realm_id, character_id)
```

Each persisted character needs, semantically:

```text
Character
├── subject_id
├── wow_account_id
├── region
├── realm_id
├── character_id
└── current presentation data
    ├── name
    ├── realm name / slug
    └── other useful current profile fields
```

The live probe confirmed that `characters[].id` and `realm.id` are directly present and stable across repeated authorization.

Character name and realm slug are presentation/discovery fields, not continuity anchors. Renaming a character must update current presentation without creating a new canonical subject or rewriting historical activity.

The `(region, realm_id, character_id)` coordinate must uniquely identify a persisted character.

## Main character designation

A selected main character is mutable guild state, not identity.

Changing the selected main:

- must not create a new subject;
- must not change the Blizzard principal coordinate;
- must not rewrite historical event records;
- must only alter which currently owned character is designated as the subject's main.

The designation may be represented as a nullable reference from the subject to one of its characters or by an equivalent constrained relationship. The implementation must guarantee that a subject cannot select another subject's character as its main.

## Establish-or-resolve ceremony

Given a completed Blizzard OAuth ceremony:

```text
1. Validate the OAuth callback state.
2. Exchange the authorization code for a user token.
3. Acquire the authenticated Blizzard principal.
4. Acquire `/profile/user/wow` for the selected region.
5. Confirm the profile principal matches the authenticated principal.
6. Resolve `(region, blizzard_principal_id)`.
7. If absent, create one GuildSubject.
8. Reconcile subordinate WoW accounts and characters from the authoritative profile response.
9. Establish an application session referencing `subject_id`.
```

Steps 3-5 are authority-bearing. A provider failure, malformed response, missing scope, or principal mismatch must fail the ceremony rather than being interpreted as a new or absent guild subject.

Repeated successful authentication for the same coordinate must resolve the existing subject rather than create another one.

## Reconciliation semantics

Authentication is also an opportunity to refresh the current Blizzard-authoritative projection beneath the subject.

Reconciliation may:

- discover newly visible WoW accounts;
- discover newly visible characters;
- refresh character names, realm presentation, level, faction, or other current profile data;
- confirm existing coordinates remain associated with the authenticated subject.

Reconciliation must not silently erase historical guild facts merely because an account or character disappears from a later Blizzard response. Current visibility and historical participation are different concerns.

The first implementation does not need to solve every possible disappearance or account-transfer case. It must avoid destructive assumptions so those cases remain representable later.

## Historical references

Operational records should reference `subject_id` as the continuity anchor.

When character context matters, an event may additionally retain the character coordinate or a reference to the character record that participated at that time.

For example:

```text
Raffle entry
└── subject_id

HiPS submission
├── subject_id
└── submitted character context, when relevant

Raid attendance
├── subject_id
└── participating character
```

A later main-character change therefore changes current presentation without changing who performed earlier actions.

## Discord boundary

Discord remains outside root establishment.

A future Discord association must resolve to an already-existing `subject_id`. Losing, replacing, or unlinking a Discord account must not affect the subject's Blizzard coordinate, WoW accounts, characters, or historical guild records.

## Minimum invariants

The persistence implementation must enforce these properties:

1. Every GuildSubject has one internal stable `subject_id`.
2. `(region, blizzard_principal_id)` resolves to at most one GuildSubject.
3. A Battle.net principal does not establish a subject without successful regional WoW profile acquisition.
4. A GuildSubject may own multiple WoW accounts.
5. A WoW account belongs to exactly one GuildSubject within the observed regional coordinate.
6. `(region, realm_id, character_id)` resolves to at most one persisted character.
7. Every character belongs to one WoW account and therefore one GuildSubject.
8. A selected main, when present, must be a character owned by that same GuildSubject.
9. Reauthentication of the same Blizzard coordinate resolves the existing GuildSubject.
10. Discord cannot establish the root subject.
11. Mutable presentation fields never serve as continuity anchors.
12. Refreshing current Blizzard state must not rewrite historical guild activity.

## Explicitly deferred

The first persistence slice does not need to decide:

- Discord-linking schema;
- guild membership status or ranks;
- raffle, HiPS, or raid schemas;
- character transfer semantics beyond avoiding destructive assumptions;
- whether Blizzard principal identifiers are globally unique across regions;
- long-term retention policy for characters no longer present in a later Account Profile response;
- database engine or ORM-specific field definitions.

Those decisions should be made only when their concrete workflow requires them.
