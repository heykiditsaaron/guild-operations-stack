# Blizzard Identity Authority Reconnaissance

## Purpose

Identify what Blizzard can authoritatively assert during Guild Operations authentication before fixing the persistence schema or implementation stack.

The desired ceremony is:

```text
Battle.net authorization
        ↓
user-authorized WoW profile access
        ↓
authoritative account/profile coordinates
        ↓
resolve or establish the Guild Operations WoW-rooted subject
```

## Confirmed authority boundary

Blizzard exposes user-specific World of Warcraft account profile data through OAuth 2.0 Authorization Code Flow.

The World of Warcraft Account Profile endpoints require a user access token carrying the `wow.profile` scope. Blizzard's published Account Profile announcement identifies these endpoints:

- `GET /profile/user/wow`
- `GET /profile/user/wow/protected-character/{realm-id}-{character-id}`
- account collection endpoints beneath `/profile/user/wow/collections`

The important distinction is that this is user-authorized profile access, not ordinary application-level Game Data API access. A successful response therefore carries authority about which WoW profile data belongs to the authenticated Battle.net user.

## Live OAuth probe

A controlled authorization ceremony was completed against the Guild Operations Blizzard client.

The authorization request required a `state` parameter. The callback returned the same value that was generated before authorization, confirming the expected CSRF-binding behavior.

The authorization-code exchange succeeded and returned:

```text
token_type: bearer
scope: wow.profile
expires_in: approximately 24 hours
```

The probe then queried:

- `GET https://oauth.battle.net/userinfo`
- `GET https://us.api.blizzard.com/profile/user/wow?namespace=profile-us&locale=en_US`

No credential, token, account identifier, BattleTag, realm name, or character name is recorded in this document.

## Confirmed identity hierarchy

The live `userinfo` response contained exactly the relevant identity fields:

```text
battletag
id
sub
```

The live WoW Account Profile response contained:

```text
_links
collections
houses
id
wow_accounts
```

Each returned WoW account had:

```text
id
characters
```

The sampled character shape contained:

```text
character
faction
gender
id
level
name
playable_class
playable_race
protected_character
realm
```

The live account used for this probe exposed one WoW account/license and twenty characters. That count is an observation from the probe, not a system invariant.

## Principal identifier relationship

The live probe established a particularly important relationship among Blizzard identifiers.

Observed types:

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

The profile-level identifier did **not** equal the returned `wow_accounts[].id`.

This is strong evidence that `/profile/user/wow` is a WoW profile projection of the authenticated Battle.net principal rather than a representation of one specific WoW license/account. The subordinate `wow_accounts[]` records occupy a distinct identity layer beneath that principal.

For Guild Operations, this materially strengthens the authenticated Blizzard principal as the continuity anchor and materially weakens any design that would use one arbitrary WoW license/account ID as the member root.

## Character coordinate structure

The live character entry confirmed that the direct character identifier is exposed as a numeric `characters[].id`.

The associated references were shaped as:

```text
character
└── href

realm
├── id
├── key
├── name
└── slug

protected_character
└── href
```

The nested `character` object is therefore a link reference, not a second copy of the character identifier. The authoritative character identity data available directly in the parent response is the numeric character ID together with the realm coordinate.

For Guild Operations, the safe character continuity coordinate is therefore:

```text
region + realm_id + character_id
```

Character name and realm slug remain presentation/discovery data rather than continuity anchors.

## Identifier stability probe

A second, independent Blizzard OAuth authorization ceremony was completed with a fresh `state`, fresh authorization code, fresh bearer token, and fresh calls to both `/oauth/userinfo` and `/profile/user/wow`.

The second ceremony was compared to the first without recording any identifier values.

Observed result:

```text
principal_stable: true
profile_id_stable: true
wow_account_ids_stable: true
character_coordinates_stable: true
first_character_count: 20
second_character_count: 20
```

This confirms that, across two independent authorization ceremonies for the same Battle.net user:

- the authenticated principal identifier remained stable;
- the top-level WoW profile identifier remained stable;
- the subordinate WoW account/license identifier set remained stable;
- the returned character coordinates remained stable.

This is sufficient live evidence for Guild Operations to treat these Blizzard-native identifiers as persisted continuity coordinates rather than merely ephemeral observations.

## Two relevant identity layers

### Authenticated Blizzard principal

Battle.net's user-info endpoint returns an authenticated account identifier (`sub` / account id) and BattleTag.

The live probe confirmed that the numeric `userinfo.id`, textual `userinfo.sub`, and numeric top-level WoW Account Profile `id` carry the same identifier value.

BattleTag is presentation data and must not be treated as the durable coordinate.

### World of Warcraft account/license records

`GET /profile/user/wow` returns the authenticated principal's WoW profile summary and contains subordinate `wow_accounts[]` records.

Conceptually, the observed hierarchy is:

```text
Authenticated Blizzard principal
└── WoW Account Profile projection
    └── wow_accounts[]
        └── characters[]
```

A single authenticated principal may expose more than one WoW account/license. The probe account happened to expose one; the API shape itself remains plural.

Therefore `wow_accounts[].id` must not be used as the canonical guild subject identifier.

## Character ownership

The Account Profile response contains the characters belonging to the user-authorized WoW account profile. Character entries expose Blizzard-native character/realm coordinates and links to the protected-character profile endpoint.

The protected endpoint is addressed using:

```text
{realm-id}-{character-id}
```

This gives Guild Operations a substantially stronger character coordinate than character name plus realm slug. Names can change; Blizzard-native IDs should be preferred.

For the initial project scope, Retail is the target. Classic behavior is not part of the root-object requirement.

## Region is part of the ceremony

WoW Profile API calls are region/namespace scoped, such as `profile-us`.

Blizzard has historically not provided a reliable way to infer a user's WoW region before making the regional profile request. Guild Operations should therefore treat region selection/resolution as an explicit part of authentication unless live testing demonstrates a newer authoritative mechanism.

The durable coordinate must not silently assume that a numeric Blizzard identifier is globally unique across regions unless Blizzard documents that property or live API semantics establish it safely. Region should remain explicit in our model until proven unnecessary.

## Current architectural conclusion

The live evidence supports modeling the canonical Guild Operations continuity anchor as the Blizzard-authenticated principal that has successfully demonstrated a WoW profile in the selected region.

Conceptually:

```text
Authenticated Blizzard principal
├── region-bound successful WoW profile acquisition
├── WoW account/license(s)
│   └── character(s)
└── later: Discord resolver
```

This remains WoW-rooted operationally: Guild Operations does not create a subject merely because a Battle.net account exists. Establishment requires successful Blizzard authorization plus successful acquisition of the user's WoW Account Profile.

A Discord identity remains incapable of establishing this root.

## Durable coordinate contract

The strongest current root coordinate is:

```text
Blizzard authenticated principal identifier + region
```

with the successful `/profile/user/wow` response acting as the ceremony that admits that principal into Guild Operations as a WoW-rooted subject.

The live probes established that:

```text
userinfo.id == userinfo.sub == profile.id
```

by identifier value, and that this value remains stable across independent authorization ceremonies.

The subordinate WoW-account/license IDs and character coordinates likewise remained stable and can be retained as Blizzard-authoritative subordinate coordinates.

The persistence model may now be designed around these relationships. Database field names and implementation details remain separate design decisions.

## Remaining verification

The root identity and subordinate character coordinate questions are sufficiently resolved for persistence design. Remaining reconnaissance is narrower and no longer blocks the root model:

1. verify that a protected-character link resolves using the same realm and character IDs exposed in the parent profile response;
2. determine whether Blizzard documents the principal identifier as globally unique or whether Guild Operations should permanently retain region as part of its canonical coordinate;
3. determine how Guild Operations should handle a successful Blizzard principal whose selected regional WoW profile contains no relevant guild character.

## Sources used for reconnaissance

Primary Blizzard material:

- Battle.net Developer Portal — OAuth documentation
- Battle.net Developer Portal — World of Warcraft Profile APIs
- Blizzard API Discussion announcement, "World of Warcraft API Update - Visions of N'zoth," documenting Account Profile and the `wow.profile` requirement

Current API descriptions were cross-checked against recently maintained API catalogs/client libraries because the current Blizzard developer portal is difficult to retrieve through automated documentation tooling. Those secondary descriptions are useful reconnaissance, but live Blizzard responses remain the final authority for our schema.
