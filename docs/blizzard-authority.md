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

## Two relevant identity layers

The authentication ceremony exposes two related but different layers.

### Battle.net account identity

Battle.net's user-info endpoint returns an authenticated account identifier (`sub` / account id) and BattleTag.

This is the identity of the Battle.net principal that completed the authorization ceremony. BattleTag is presentation data and must not be treated as the durable coordinate.

### World of Warcraft account profile

`GET /profile/user/wow` returns the authenticated user's WoW profile summary. Current API descriptions expose:

```text
profile
├── id
└── wow_accounts[]
    ├── id
    └── characters[]
```

A single authenticated Battle.net principal may therefore expose more than one WoW account/license, each with its own identifier and character set.

This distinction matters: `wow_accounts[].id` should not automatically be assumed to be the one canonical guild subject identifier.

## Character ownership

The Account Profile response contains the characters belonging to the user-authorized WoW account profile. Character entries expose Blizzard-native character/realm coordinates and links to the protected-character profile endpoint.

The protected endpoint is addressed using:

```text
{realm-id}-{character-id}
```

This gives Guild Operations a substantially stronger character coordinate than character name plus realm slug. Names can change; Blizzard-native IDs should be preferred wherever the live API confirms their semantics.

For the initial project scope, Retail is the target. Classic behavior is not part of the root-object requirement.

## Region is part of the ceremony

WoW Profile API calls are region/namespace scoped, such as `profile-us`.

Blizzard has historically not provided a reliable way to infer a user's WoW region before making the regional profile request. Guild Operations should therefore treat region selection/resolution as an explicit part of authentication unless live testing demonstrates a newer authoritative mechanism.

The durable coordinate must not silently assume that a numeric Blizzard identifier is globally unique across regions unless Blizzard documents that property or live API semantics establish it safely. Region should remain explicit in our model until proven unnecessary.

## Current architectural conclusion

The evidence does **not** support modeling one arbitrary `wow_accounts[].id` as the guild member root.

The stronger candidate is the authenticated **WoW profile principal**: the Battle.net principal that has successfully authorized `wow.profile`, scoped into our WoW-only domain. Its WoW account/license records and characters are subordinate facts discovered through the Account Profile response.

Conceptually:

```text
Authenticated WoW profile subject
├── Battle.net principal coordinate
├── region
├── WoW account/license(s)
│   └── character(s)
└── later: Discord resolver
```

This remains WoW-rooted operationally: Guild Operations does not create a subject merely because a Battle.net account exists. Establishment requires successful Blizzard authorization plus successful acquisition of the user's WoW Account Profile.

A Discord identity remains incapable of establishing this root.

## Candidate durable coordinate

Pending live-response verification, the safest candidate is a composite coordinate derived from:

```text
Battle.net authenticated subject identifier + region
```

with the successful `/profile/user/wow` response acting as the ceremony that admits that principal into Guild Operations as a WoW-rooted subject.

The profile-level `id`, WoW-account/license IDs, and character IDs should be retained as Blizzard-authoritative subordinate coordinates once their exact live-response semantics are confirmed.

We should **not yet name database fields or freeze a schema around these identifiers**.

## What requires live verification

Before schema work begins, perform one real authorization against our own Battle.net developer client and capture the structure — not secrets — of:

1. the token response and granted scopes;
2. `/oauth/userinfo`;
3. `/profile/user/wow?namespace=profile-us`;
4. one returned character coordinate;
5. if useful, that character's Blizzard-provided protected-character link.

The test should answer:

- Does `userinfo.sub` correspond directly to `userinfo.id`, and in what representation?
- What precisely does the top-level `/profile/user/wow.id` identify?
- What precisely does each `wow_accounts[].id` identify?
- Are these IDs stable across repeated authorization?
- Are any identifiers documented or observable as region-global rather than region-scoped?
- Which native character identifiers are present directly in the Account Profile payload in the current Retail API?

Only after those questions are answered should Guild Operations freeze the root persistence contract.

## Sources used for reconnaissance

Primary Blizzard material:

- Battle.net Developer Portal — OAuth documentation
- Battle.net Developer Portal — World of Warcraft Profile APIs
- Blizzard API Discussion announcement, "World of Warcraft API Update - Visions of N'zoth," documenting Account Profile and the `wow.profile` requirement

Current API descriptions were cross-checked against recently maintained API catalogs/client libraries because the current Blizzard developer portal is difficult to retrieve through automated documentation tooling. Those secondary descriptions are useful reconnaissance, but live Blizzard responses remain the final authority for our schema.
