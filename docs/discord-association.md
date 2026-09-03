# Discord association

Discord association lets an existing Guild Operations subject prove control of a Discord account and attach that account as an optional interaction coordinate.

Discord does not establish the Guild Operations subject. The canonical subject remains rooted in Blizzard-authenticated World of Warcraft continuity.

## Product role

Discord association is optional, but optional does not mean inconsequential.

A member who has proven guild membership must still have meaningful ways to participate in Guild Operations without associating Discord. Guild Operations must not become a thin prerequisite screen for Discord.

Association is nevertheless allowed to materially expand and improve participation. It may enable faster Discord-originated actions, direct mentions, personalized notifications, Discord-native interaction surfaces, and features whose useful behavior inherently depends on knowing the Discord account associated with a subject.

There is no requirement that Discord-associated and unassociated members receive feature parity. Features are evaluated case by case.

The durable product constraint is:

> Discord association is never required for meaningful Guild Operations participation, but association is allowed to materially expand and improve that participation.

## Authority

The association ceremony answers one question:

> Which existing Guild Operations subject has proven control of this Discord account?

It does not answer whether that Discord account is currently present in the guild Discord server, what Discord roles it has, or what Guild Operations actions the subject may perform.

Those are separate observations or authorization questions.

Discord usernames, display names, server nicknames, avatars, and roles are not identity coordinates. The Discord user ID is the durable Discord coordinate.

## Persisted Discord data

The initial association persists only the Discord data required to make the resolver useful and the result understandable to the member:

```text
subject_id
discord_user_id
username
connected_at
```

The Discord user ID is the durable association coordinate. The username is presentation metadata retained so a member can recognize which Discord account they connected; it is not identity truth.

Guild Operations does not treat Discord as a profile domain. It should not retain a broad Discord user object merely because the OAuth response makes one available.

Additional Discord data may be added later when a concrete Guild Operations feature creates a real requirement for it. The model is intentionally extensible, but Discord profile data is not promoted into the domain speculatively.

## Web presentation

Discord association should have a deliberately small web footprint.

When no Discord account is associated, the authenticated `Me` surface should expose an obvious `Connect Discord` action.

When an account is associated, the same surface should show a compact state: a green association-status indicator, the stored Discord username, and `Discord` subtext identifying the service. The same compact state should expose a subordinate `Disconnect` action so the member can remove the optional association without affecting their Guild Operations subject or session.

The green indicator means that the Discord association exists. It does not represent Discord online presence.

No dedicated Discord profile page is required for this slice.

## Ceremony

Association begins from an authenticated Guild Operations session.

The server creates a short-lived OAuth attempt bound to the current `subject_id`, then redirects the member through Discord's authorization-code ceremony with only the identity scope required to obtain the authenticated Discord user.

On callback, the server:

1. consumes and validates the short-lived OAuth state;
2. verifies the browser still carries the same Guild Operations subject session that initiated the ceremony;
3. exchanges the Discord authorization code server-side;
4. obtains the authenticated Discord user identity;
5. uses the Discord user ID as the association coordinate;
6. retains the returned username only as minimal recognition metadata;
7. applies the association conflict rules before persistence.

Discord OAuth access credentials are ceremony material, not durable Guild Operations identity state. They are not retained merely to preserve the association.

Disassociation is intentionally simpler. An authenticated member may remove the Discord association belonging to their current Guild Operations subject. The operation deletes only that association; it does not alter the subject, Blizzard authority, selected main, session, or historical guild activity. Repeating the operation when no association exists is harmless.

## Association law

The relationship is one-to-one:

- one Guild Operations subject may have at most one associated Discord user ID;
- one Discord user ID may be associated with at most one Guild Operations subject.

Association outcomes are deliberately narrow:

- an unassociated Discord ID plus an unassociated subject establishes the association;
- a Discord ID already associated with the same subject is idempotent success;
- a Discord ID associated with another subject is a conflict and changes nothing;
- a subject already associated with another Discord ID is a conflict and changes nothing.

A subject may disassociate its currently attached Discord account. Once removed, that Discord user ID is no longer a resolver for the subject and either side is free to establish a later valid association through the normal proof ceremony.

This slice defines no automatic reassignment, replacement, merge, or officer-mediated linking ceremony.

## Resolver

Once associated, a trusted Discord interaction may later use the Discord user ID to resolve the canonical Guild Operations subject:

```text
Discord user ID
      ↓
Discord association
      ↓
Guild Operations subject
      ↓
current Guild Operations truth and authorization
```

The association itself grants no Guild Operations capability. It only makes resolution possible.

A later Discord interaction surface must still ask the backend whether the resolved subject may perform the requested domain operation.

## Boundaries

Discord association is distinct from Discord server membership. The association ceremony should not acquire broader Discord scopes merely because server membership may matter later.

Discord association is also distinct from selected-main presentation. Changing a selected main must not alter the Discord association, and changing or removing a Discord association must not alter the Guild Operations subject.

The web application remains a first-class participation surface. Discord is an accelerator and an additional medium, not the owner of Guild Operations truth.
