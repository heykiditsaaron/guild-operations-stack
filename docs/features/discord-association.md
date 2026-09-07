# Discord association

Discord association lets an existing Guildie prove control of a Discord account and attach that account as an optional interaction coordinate.

The Guildie is identified by Guild Operations' durable `guildie_id`. Discord does not establish the Guildie or create an independent canonical member. Guildie establishment remains rooted in Blizzard-authenticated World of Warcraft account authority.

## Product role

Discord association is optional, but optional does not mean inconsequential.

A Guildie who has established current guild participation must still have meaningful ways to participate in Guild Operations without associating Discord. Guild Operations must not become a thin prerequisite screen for Discord.

Association is nevertheless allowed to materially expand and improve participation. It may enable faster Discord-originated actions, direct mentions, personalized notifications, Discord-native interaction surfaces, and features whose useful behavior inherently depends on knowing the Discord account associated with a Guildie.

There is no requirement that Discord-associated and unassociated Guildies receive feature parity. Features are evaluated case by case.

The durable product constraint is:

> Discord association is never required for meaningful Guild Operations participation, but association is allowed to materially expand and improve that participation.

## Authority

The association ceremony answers one question:

> Which existing Guildie has proven control of this Discord account?

The durable implementation coordinate for that Guildie is `guildie_id`.

The ceremony does not answer whether that Discord account is currently present in the guild Discord server, what Discord roles it has, whether the Guildie currently has a participation surface, or what Guild Operations actions the Guildie may perform.

Those are separate observations or authorization questions.

Discord usernames, display names, server nicknames, avatars, and roles are not identity coordinates. The Discord user ID is the durable Discord coordinate.

## Persisted Discord data

The initial association persists only the Discord data required to make the resolver useful and the result understandable to the Guildie:

```text
guildie_id
discord_user_id
username
connected_at
```

`guildie_id` identifies the Guildie. The Discord user ID is the durable Discord association coordinate. The username is presentation metadata retained so a Guildie can recognize which Discord account they connected; it is not identity truth.

Guild Operations does not treat Discord as a profile domain. It should not retain a broad Discord user object merely because the OAuth response makes one available.

Additional Discord data may be added later when a concrete Guild Operations feature creates a real requirement for it. The model is intentionally extensible, but Discord profile data is not promoted into the domain speculatively.

## Web presentation

Discord association should have a deliberately small web footprint.

When no Discord account is associated, the authenticated `Me` surface should expose an obvious `Connect Discord` action.

When an account is associated, the same surface should show a compact state: a green association-status indicator, the stored Discord username, and `Discord` subtext identifying the service. The same compact state should expose a subordinate `Disconnect` action so the Guildie can remove the optional association without affecting Guildie continuity or the application session.

The green indicator means that the Discord association exists. It does not represent Discord online presence.

No dedicated Discord profile page is required for this slice.

## Ceremony

Association begins from an authenticated Guild Operations session.

The application session resolves to `guildie_id`. The server creates a short-lived OAuth attempt bound to that Guildie, then redirects the Guildie through Discord's authorization-code ceremony with only the identity scope required to obtain the authenticated Discord user.

On callback, the server:

1. consumes and validates the short-lived OAuth state;
2. verifies the browser still carries the same Guild Operations Guildie session that initiated the ceremony;
3. exchanges the Discord authorization code server-side;
4. obtains the authenticated Discord user identity;
5. uses the Discord user ID as the association coordinate;
6. retains the returned username only as minimal recognition metadata;
7. applies the association conflict rules before persistence.

Discord OAuth access credentials are ceremony material, not durable Guild Operations state. They are not retained merely to preserve the association.

Disassociation is intentionally simpler. An authenticated Guildie may remove the Discord association keyed by their current `guildie_id`. The operation deletes only that association; it does not alter Guildie continuity, Blizzard authority, selected main, session, current Character roster truth, or historical guild activity. Repeating the operation when no association exists is harmless.

## Association law

The relationship is one-to-one:

- one Guildie may have at most one associated Discord user ID;
- one Discord user ID may be associated with at most one Guildie.

Association outcomes are deliberately narrow:

- an unassociated Discord ID plus an unassociated Guildie establishes the association;
- a Discord ID already associated with the same Guildie is idempotent success;
- a Discord ID associated with another Guildie is a conflict and changes nothing;
- a Guildie already associated with another Discord ID is a conflict and changes nothing.

A Guildie may disassociate their currently attached Discord account. Once removed, that Discord user ID is no longer a resolver for the Guildie and either side is free to establish a later valid association through the normal proof ceremony.

This slice defines no automatic reassignment, replacement, merge, or officer-mediated linking ceremony.

## Resolver

Once associated, a trusted Discord interaction may later use the Discord user ID to resolve the Guildie directly:

```text
Discord user ID
      ↓
Discord association
      ↓
Guildie
      ↓
current Guild Operations truth and authorization
```

The association itself grants no Guild Operations capability. It only makes resolution possible.

A later Discord interaction surface must still ask the backend whether the resolved Guildie may perform the requested domain operation.

A Guildie may remain Discord-associated even when no controlled Character is currently on the Blizzard Character roster. Loss of the current participation surface does not destroy the Guildie or the Discord association.

## Publications and projections

Discord association changes are Guildie-domain occurrences:

```text
guildie.discord.linked
guildie.discord.unlinked
```

The publications carry `guildie_id` as the durable coordinate identifying the affected Guildie. On unlink, the disappearing `discord_user_id` may also be included so a subscriber can remove stale Discord-side projection state.

Publication does not make Discord authoritative. Subscribers such as BotGhost should use the publication as attention, query Guild Operations when current truth matters, and converge their own projection from the backend's current state.

## Boundaries

Discord association is distinct from Discord server membership. The association ceremony should not acquire broader Discord scopes merely because server membership may matter later.

Discord association is also distinct from selected-main presentation. Changing a selected main must not alter the Discord association, and changing or removing a Discord association must not alter Guildie continuity.

`Subject` is contextual language only. It is not part of the Discord association object model or persistence relationship.

The web application remains a first-class participation surface. Discord is an accelerator and an additional medium, not the owner of Guild Operations truth.
