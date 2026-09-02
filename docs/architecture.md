# Architecture

## Purpose

Guild Operations exists specifically for **OH CRIT I Pulled!** and its Discord community.

Its purpose is to provide an interactive participation layer for the guild outside of World of Warcraft. World of Warcraft remains where the guild exists; Guild Operations extends the guild's activities into places and times where the game client is not available or appropriate.

Guild Operations is not an Armory replacement, a generic identity-linking platform, or a general-purpose guild product.

The system should be judged primarily by whether a capability helps to:

- establish authority to participate as a guild member;
- enable guild participation;
- operate guild participation; or
- preserve the history and results of that participation.

## Architectural center

The system has two related but distinct concerns:

1. **Who the user is in World of Warcraft.**
2. **Who that authenticated subject is in OH CRIT I Pulled!.**

The first exists mainly to establish authority. The second is the operational center of the product.

Conceptually:

```text
Blizzard authentication
        ↓
WoW-rooted subject
        ↓
prove authority over Blizzard-observed characters
        ↓
resolve guild-facing membership
        ↓
participate in OH CRIT I Pulled!
```

Blizzard authentication answers:

> Who is this user allowed to act as?

Guild Operations then answers:

> What does that member do, receive, join, claim, earn, and participate in within OH CRIT I Pulled!?

## Canonical subject

The canonical operational subject is established from Blizzard-authenticated World of Warcraft identity.

Conceptually:

```text
GuildSubject
├── Blizzard principal
├── WoW accounts
├── Blizzard-authoritative character roster
└── guild-facing membership
```

The canonical subject is an internal continuity anchor. It is foundational, but it is not the primary user-facing product object.

Discord must never create the root subject. A Discord identity may resolve to an existing WoW-rooted subject after an explicit linking flow.

Changing Discord accounts or changing a selected main character must not create a new operational subject or rewrite historical guild activity.

## Authentication and member authority

Blizzard authentication exists so a person interacting outside of the game can prove authority over the WoW identity that represents them in the guild.

The authenticated Blizzard account provides an authoritative roster of characters controlled by that subject. Guild Operations can use that roster to support member-controlled declarations such as:

- selecting a guild main;
- identifying which character made a raffle deposit;
- selecting a character for a raid signup;
- identifying the character used for an activity or submission.

The authentication subject is therefore primarily an authority boundary, not a rich profile surface.

## Character representation

Character representation should remain deliberately light.

Guild Operations needs enough character information for recognition and precise selection in participatory workflows, typically including:

- durable Blizzard character coordinate;
- name;
- realm;
- class;
- level;
- optional portrait or avatar reference; and
- optional link to Blizzard's own character profile surface.

Guild Operations should not recreate an Armory-style character profile. Rich character inspection already exists elsewhere and is outside this system's purpose.

A portrait or avatar is useful because it improves quick recognition in selection interfaces; it is presentation enrichment, not identity-critical state.

## Guild-facing membership

Most operational behavior belongs to the member's relationship with **OH CRIT I Pulled!**, not to the Blizzard account itself.

Conceptually:

```text
GuildMember
├── subject_id
├── guild characters
├── selected main
├── guild rank / standing
├── participation history
├── raffle activity
├── Hidden in Plain Sight activity
├── raid activity
├── rewards
└── guild-specific permissions
```

Where Blizzard can authoritatively expose both the authenticated subject's character roster and the guild roster, Guild Operations should prefer joining those authoritative facts instead of asking the member to manually type character identity.

This allows the system to distinguish between:

- characters the authenticated subject controls; and
- the subset of those characters that represent that subject inside OH CRIT I Pulled!.

The guild-facing subset is expected to be more operationally important than the subject's complete Blizzard character roster.

## Interface model

The backend owns singular truthful operational state. Interfaces present and manipulate that state according to their medium.

Expected interfaces include:

- Web dashboard
- Discord bot / BotGhost integration
- A possible future WoW addon

No interface should become the sole keeper of meaningful guild operational state.

Member-facing interfaces may display a small persistent member context or "member strip" so the user can recognize whom they are acting as while participating. That presentation is context for interaction, not a profile product.

For web access, authentication begins with Blizzard/Battle.net authorization and resolves the authenticated user to the canonical WoW-rooted subject before establishing the application session.

## Human authority

Guild Operations automates persistence, procedure, visibility, and lifecycle management. It does not manufacture human judgment.

Where a guild workflow requires an officer, attendant, or other authorized person to decide something, the backend should record and constrain that decision rather than pretending to verify facts it cannot authoritatively observe.

For example, a raffle claim may precisely reference a Blizzard-authoritative guild character, while an authorized raffle attendant still decides whether the corresponding guild-bank deposit was actually made.

## Participation model

Guild Operations exists to support guild activity across interfaces and across time.

Examples include:

- raffle claims and adjudication;
- Hidden in Plain Sight events;
- raid signups and participation;
- rewards;
- guild events;
- participation history; and
- future guild activities not yet designed.

These activities may be synchronous or asynchronous. The system should allow the guild to continue participating as a community even when members are not simultaneously logged into World of Warcraft.

## Initial implementation status

The first executable capability is complete:

> Given successful Blizzard authentication, establish or resolve the canonical WoW-rooted subject.

The implementation has been validated against live Blizzard authentication and now provides the authority foundation required to resolve the authenticated subject into guild-facing membership and participation.

## Workflow

This repository intentionally uses a lightweight development process. It does not use numbered task documents or development journals. Architecture documentation should preserve only durable decisions that materially constrain later work.
