# Blizzard Authority Evidence

## Purpose

This document records the Blizzard API evidence that informed Guild Operations' member and guild authority model.

It is an evidentiary record rather than the canonical definition of Guildie, authentication, persistence, or guild-authority semantics. Those contracts live in:

- [`member-objects.md`](member-objects.md)
- [`authentication-ceremony.md`](authentication-ceremony.md)
- [`persistence-boundary.md`](persistence-boundary.md)
- [`guild-authority.md`](guild-authority.md)

The evidence here is preserved because several architectural choices were earned through direct Blizzard observation rather than assumed from API shape alone.

## User-authorized WoW profile authority

Blizzard exposes user-specific World of Warcraft account profile data through OAuth 2.0 Authorization Code Flow.

The World of Warcraft Account Profile surface requires a user token carrying `wow.profile`. The relevant observed flow was:

```text
Battle.net authorization
        ↓
GET /oauth/userinfo
        +
GET /profile/user/wow for selected region
        ↓
corroborated Blizzard principal
        +
WoW account(s)
        +
controlled Character coordinates
```

This is user-authorized account authority rather than ordinary application-level Game Data access.

A controlled OAuth probe confirmed that callback `state` round-tripped as expected and that the authorization-code exchange returned a bearer token carrying `wow.profile` with an approximately 24-hour lifetime.

No credential, access token, BattleTag, account identifier, realm name, or Character name is recorded in this document.

## Observed account hierarchy

The live `userinfo` response exposed:

```text
battletag
id
sub
```

The live WoW Account Profile response exposed:

```text
id
wow_accounts[]
```

Each returned WoW account exposed its own `id` and `characters[]` collection.

The observed hierarchy was therefore:

```text
Authenticated Blizzard principal
└── WoW Account Profile projection
    └── wow_accounts[]
        └── characters[]
```

The probe account happened to expose one WoW account/license and twenty Characters. Those counts are observations, not invariants.

## Principal-coordinate evidence

The live probe established these types:

```text
userinfo.id: integer
userinfo.sub: string
profile.id: integer
wow_accounts[].id: integer
```

When compared by textual value:

```text
userinfo.id == userinfo.sub == profile.id
```

The top-level profile identifier did **not** equal the subordinate `wow_accounts[].id`.

A second independent OAuth ceremony, with fresh state, code, token, and API calls, confirmed that the following remained stable for the same Blizzard user:

```text
principal identifier
profile identifier
WoW account identifier set
Character coordinates
```

This evidence supports the current external authority coordinate:

```text
region + Blizzard authenticated principal identifier
```

and supports treating subordinate WoW-account identifiers as account structure rather than as Guildie continuity.

Whether Blizzard guarantees principal uniqueness globally across regions has not been established strongly enough to remove region from the coordinate, so region remains explicit.

## Character-coordinate evidence

Character entries in the account profile exposed numeric Character IDs together with realm identifiers and locators.

The protected Character endpoint was addressed using:

```text
{realm-id}-{character-id}
```

Across independent authorization ceremonies, the Character coordinates remained stable.

This supports the durable Character coordinate used throughout Guild Operations:

```text
region + realm_id + character_id
```

Character name, realm name, realm slug, and other presentation fields are therefore not continuity anchors.

## Guild-roster evidence

Separate live Blizzard guild reconnaissance established the configured guild as:

```text
guild_id: 65431436
region: us
realm_id: 129
realm_slug: gurubashi
name: OH CRIT I Pulled
```

The numeric Blizzard `guild_id` is the stable guild coordinate used by Guild Operations. Name, realm labels, faction, and lookup locators are observations or addressing material rather than guild continuity.

The live roster sample used during authority modeling contained 517 Character members. Each membership supplied Blizzard Character coordinates and a numeric `rank`.

When that roster was compared with one authenticated Guildie's account-control observation, the sample contained:

```text
authenticated controlled Characters: 20
current roster intersections: 9
```

All nine intersections matched through Blizzard Character and realm identifiers rather than Character name.

That empirical result established that account-control and guild-roster observations can be joined through Blizzard-native Character coordinates. The resulting Guildie participation semantics are defined in [`guild-authority.md`](guild-authority.md).

## Rank evidence

The live roster sample contained populated numeric ranks:

```text
0, 1, 2, 3, 4, 5, 7
```

Rank `6` had no roster occupants and was intentionally unused by the guild at the time of observation.

The Blizzard Guild Profile and Guild Roster responses observed during reconnaissance did not expose the guild's custom human-readable rank names.

This evidence supports two durable conclusions used elsewhere:

- the numeric rank attached to a current roster Character is Blizzard-owned truth;
- Guild Operations must not infer the complete rank-definition space from whichever rank values happen to be populated in one roster observation.

How numeric rank becomes current Guildie authority or application permission is defined in [`guild-authority.md`](guild-authority.md) and [`guild-permissioning.md`](guild-permissioning.md).

## Region evidence

WoW Profile API requests are region/namespace scoped, for example `profile-us`.

No sufficiently authoritative mechanism was established during reconnaissance for deriving a user's WoW region before regional profile acquisition. Region therefore remains an explicit part of the authentication ceremony and persisted Blizzard principal coordinate.

## What this evidence established

The probes were sufficient to support these architectural choices:

```text
Guild Operations Guildie continuity
    → guildie_id

external Blizzard authority binding
    → region + authenticated principal identifier

subordinate account structure
    → WoW account identifier(s)

Character continuity
    → region + realm_id + character_id

guild continuity
    → Blizzard numeric guild_id

current guild rank
    → Blizzard numeric rank on current roster membership
```

This document does not independently define the ceremonies or persistence rules that consume those coordinates.

## Remaining evidence questions

The root coordinate questions are no longer blockers. Narrower Blizzard questions may still be investigated when concrete work requires them, including whether Blizzard formally guarantees principal uniqueness across regions or exposes stronger region-discovery semantics.

New evidence should update the appropriate canonical contract only when it materially changes what Guild Operations can legitimately assert.
