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

A useful product test is:

> Does this help establish authority to participate, enable guild participation, operate that participation, or preserve its history?

If not, it probably does not belong.

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

The foundational identity and authority model exists to make that second question safe and durable. It is not the product destination by itself.

## Canonical subject

The canonical operational subject is established from Blizzard-authenticated World of Warcraft identity.

Conceptually:

```text
GuildSubject
├── Blizzard principal
├── WoW accounts
├── Blizzard-authoritative characters
├── selected main
└── optional Discord association
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

## Character representation and recognition

Character representation should remain deliberately light and should favor **recognition cues** over profile completeness.

For Guild Operations, the most useful current recognition cues are the facts that answer how a member is encountered in normal guild play:

- character name;
- class and active specialization, when available;
- realm; and
- current guild rank.

Those cues are operationally meaningful for distinct reasons:

```text
class / specialization
    → how the character primarily participates in gameplay

realm
    → where that character exists in WoW

guild rank
    → how that character currently participates in OH CRIT I Pulled!
```

Other Blizzard facts such as level, race, item level, achievements, and similar profile information may be legitimate observations but are incidental to this recognition purpose unless a concrete guild workflow requires them.

Guild Operations should not recreate an Armory-style character profile. Rich character inspection already exists elsewhere and is outside this system's purpose.

A portrait or avatar is useful because it improves quick recognition in selection interfaces; it is presentation enrichment, not identity-critical state.

Recognition surfaces should prepare semantic styling seams when a known guild fact is likely to gain stronger recognition treatment later. For example, guild rank presentation may expose a stable rank-specific presentation hook without prematurely defining colors, badges, or other visual policy. Prepare the seam, not the speculative feature.

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

## Guild authority

Blizzard publishes two independent authority surfaces that Guild Operations can join:

```text
Authenticated Account Profile
        ∩
Public OH CRIT I Pulled! Guild Roster
        ↓
current guild characters controlled by the subject
```

Live reconnaissance proved that both surfaces expose the same durable character coordinate shape: region, realm id, and character id. Guild membership should therefore be resolved by those Blizzard-native coordinates rather than by character name.

The canonical guild reference is Blizzard numeric guild id `65431436`. The guild's name, realm labels, faction, and similar fields are observed presentation state. They may change without changing the guild's identity.

Roster observations are current Blizzard truth, not destructive history reconciliation. A character disappearing from a later roster observation should cease to be currently present without erasing historical Guild Operations activity involving that character or member.

## Guild rank projection

Blizzard publishes a numeric rank on each guild roster membership but does not expose OH CRIT I Pulled!'s custom rank names through the Guild Profile or Guild Roster surfaces observed in live reconnaissance.

Therefore:

> Blizzard owns the numeric guild rank fact. Guild Operations owns configurable meaning and presentation for that number outside WoW.

Conceptually:

```text
Guild 65431436 / Rank N
├── canonical
│   └── rank_index = N
└── Guild Operations metadata
    ├── display_name
    ├── active/inactive presentation state
    ├── later: Discord role projection
    └── member-facing capabilities
```

Rank metadata must be keyed by the canonical numeric rank rather than inferred from currently populated roster values. The guild intentionally leaves rank `6` unused today, demonstrating that the observed rank set may be sparse.

Discord roles and Guild Operations capabilities may both project from the same rank metadata, but Discord role membership must not become backend authorization truth. System operator authority remains a separate first-party authorization concern and is not implied by WoW guild rank.

Guild rank is also a valid member recognition cue. Presentation may eventually use rank names, colors, badges, or other distinctions, but those treatments are Guild Operations presentation policy layered over Blizzard's current numeric rank fact.

## Interface model

The backend owns singular truthful operational state. Interfaces present and manipulate that state according to their medium.

Expected interfaces include:

- Web dashboard
- Discord bot / BotGhost integration
- A possible future WoW addon

No interface should become the sole keeper of meaningful guild operational state.

Member-facing interfaces may display a small persistent member context or "member strip" so the user can recognize whom they are acting as while participating. That presentation is context for interaction, not a profile product.

The member context should answer three progressively different questions without collapsing them into one generic account surface:

```text
Who am I presenting as?
What is associated with me?
What can I do to this session?
```

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

Guild Operations preserves, enables, and enriches community participation. It does not replace the human and social processes that give that participation meaning.

## Model maturity and feature pressure

The foundational model is now sufficient to support concrete member-facing work. It establishes:

- WoW-rooted subject continuity;
- Blizzard account authority;
- current guild authority;
- durable character continuity;
- selected-main presentation;
- optional Discord association;
- rank-derived Guild Operations capabilities;
- external refresh and reconciliation boundaries; and
- a renderer boundary in which interfaces project backend truth.

Further generalized modeling should not be performed merely because another abstraction can be imagined.

The next useful pressure should come from real guild participation features. Shared event, notification, audit, participation, or interface abstractions should emerge only when multiple concrete workflows demonstrate that they are actually shared.

In short:

> Build the guild activity. Let the common machinery reveal itself under pressure.

## Current implementation direction

The foundational authority and interface model is in place. The next product-level question is no longer primarily "who is this user?" but:

> **What does a guild member get to do with Guild Operations?**

Concrete participation features should now drive the next architectural discoveries.

## Workflow

This repository intentionally uses a lightweight development process. It does not use numbered task documents or development journals. Architecture documentation should preserve only durable decisions that materially constrain later work.
