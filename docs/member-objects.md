# Member Objects

This document records the current working understanding of the user-facing and user-related objects in Guild Operations and how we intend to use them.

It is guidance rather than hard doctrine. These distinctions have proven useful while building the foundation, but concrete guild participation features are allowed to put pressure on them. If later work reveals a better boundary, the model should follow the demonstrated need rather than preserve terminology for its own sake.

## Why these objects exist

Guild Operations needs to recognize a real guild member outside World of Warcraft without turning itself into a generic identity platform or an Armory replacement.

The objects below separate several questions that are easy to accidentally collapse:

- Who is this person to Guild Operations?
- What Blizzard account authority have they demonstrated?
- Which WoW characters do they control?
- Which of those characters currently belong to OH CRIT I Pulled!?
- Which character do they prefer to present as?
- Which Discord identity, if any, can resolve back to them?
- What are they currently allowed to do in Guild Operations?

The distinctions matter because those answers come from different authorities and change at different rates.

## Subject

The **subject** is Guild Operations' durable continuity for a member.

It is the object other Guild Operations records should generally point at when they mean the member rather than one particular character, login, or interface identity.

A subject is established from Blizzard-authenticated WoW continuity. It is not created from Discord, a selected main, a character name, or a guild rank.

The subject gives the application a stable internal coordinate even while the externally observed facts around that member change.

### Intended use

Use the subject for facts that belong to the member across interfaces and across changes in presentation, for example:

- participation in a Guild Operations activity;
- an action taken by a member;
- a guild-created decision or award concerning that member;
- optional associations such as Discord;
- the member's selected main;
- application/session continuity.

Do not use a character as a substitute for the subject merely because the UI happens to display the member through a character.

## Blizzard principal and account authority

The Blizzard-authenticated principal establishes that the person operating the browser controls the corresponding Blizzard account context.

The root external coordinate is currently:

```text
region + Blizzard authenticated principal identifier
```

The authenticated account profile then reveals subordinate WoW account and character information.

This is primarily an **authority and resolution mechanism**, not something we expect members to manage as a visible Guild Operations profile.

### Intended use

Use Blizzard account authority when Guild Operations needs to establish or refresh what the authenticated person legitimately controls.

Do not treat authentication itself as guild membership. Account authority answers "what do you control?"; guild authority answers whether any of that controlled WoW identity currently participates in OH CRIT I Pulled!.

## WoW account

A WoW account is subordinate to the subject and represents account structure observed through Blizzard.

It exists because Blizzard's own account model contains this boundary and because characters are observed through it. It is not currently a meaningful member-facing Guild Operations concept.

### Intended use

Preserve the WoW account boundary where it helps accurately represent Blizzard observations and acquisition. Do not invent product behavior around it unless a concrete feature eventually needs that distinction.

## Character

A **character** is a durable WoW object subordinate to a subject when that subject has demonstrated control of it.

The durable character coordinate is currently:

```text
region + realm_id + character_id
```

Character names and other presentation facts can change; the durable coordinate is what allows Guild Operations to retain continuity.

Characters also exist independently in the guild roster observation. A roster character does not need to have authenticated through Guild Operations before the application can know that the character currently belongs to the guild.

### Intended use

Characters are appropriate when the fact or activity genuinely concerns a particular WoW character.

They are also the primary recognition surface for members because WoW characters are how guildmates commonly recognize one another in the game.

For ordinary member presentation, favor recognition cues over profile completeness. The current useful cues are:

- character name;
- class / active specialization;
- realm;
- current guild rank.

Level, race, item level, achievements, and similar facts may be legitimate Blizzard observations, but they should not automatically become Guild Operations presentation. Add such information only when a concrete guild workflow needs it.

Portrait/media is recognition enrichment rather than identity-critical state.

## Current guild membership

Guild membership is a current Blizzard observation, not permanent identity.

A subject can be recognized as a current guild member when a character the subject controls intersects the current Blizzard roster for OH CRIT I Pulled!.

Conceptually:

```text
subject-controlled character
        ∩
current Blizzard guild roster
        ↓
current guild participation
```

This relationship can change without creating or destroying the subject or rewriting historical Guild Operations activity.

### Intended use

Use current guild membership when an operation genuinely requires the actor to be a current member.

Do not erase historical participation because a member later leaves the guild, transfers a character, or otherwise stops appearing in the current roster.

## Guild rank

The guild rank number is a current Blizzard-owned fact attached to roster membership.

Guild Operations may interpret that rank for its own purposes, including:

- capability/authorization decisions;
- member recognition and presentation;
- future rank-specific presentation where useful.

The current rule is:

> Blizzard owns the rank number. Guild Operations owns what that number means outside WoW.

The selected main does not determine effective authority. Where rank-derived authority is required, Guild Operations uses the highest-authority current controlled roster character.

### Intended use

Rank is both an authorization input and a legitimate guild recognition cue.

Keep those uses conceptually separate. A UI may display the rank of the character being presented while backend authorization evaluates the subject's effective current guild authority.

Do not invent rank names, colors, badges, or other meaning that Guild Operations has not actually established. Semantic presentation hooks may exist in advance so later truthful presentation does not require restructuring.

## Selected main

The **selected main** is a Guild Operations-owned presentation preference.

It answers:

> Which eligible guild character does this member want Guild Operations to present them through?

It does **not** answer:

- who the subject is;
- what Blizzard account they control;
- whether they are a current guild member;
- what authority they possess;
- which character historically performed an action unless the activity explicitly records that character.

Changing the selected main must not create a new subject or rewrite existing history.

### Intended use

Use the selected main as the default member recognition surface where a character presentation is useful.

The current Me surface demonstrates the intended distinction: the selected main supplies the visible character identity and recognition cues, while the underlying session and member continuity remain subject-based.

A stored selection may remain recorded if the character later becomes ineligible; the current projection should simply treat that selection as unavailable until the member chooses an eligible main.

## Discord identity

A Discord identity is an optional association with an existing WoW-rooted subject.

The canonical external coordinate is the Discord user ID. Username is presentation data.

Discord does not create a Guild Operations subject and association grants no authority by itself.

Conceptually:

```text
Discord identity ─────┐
                      ├──► subject
Blizzard web login ───┘
```

The two paths resolve toward the same member continuity; they are not competing identities.

### Intended use

Discord association should make participation more convenient where Discord is a useful interaction surface. It may allow a Discord interaction to resolve immediately to the corresponding Guild Operations member.

It should remain optional. A member who does not associate Discord should still be able to participate meaningfully through other Guild Operations interfaces.

Do not infer association from usernames, character names, officer judgment, bot state, or a selected main when Discord OAuth can establish the relationship directly.

Association is also distinct from Discord server membership. Knowing which Discord account belongs to a subject does not by itself establish what servers, roles, or channels that account currently has.

## Session

The application session represents an authenticated interaction with a subject.

The session resolves to `subject_id`; it is not tied to the selected main or Discord identity.

### Intended use

Use session state to establish which subject is currently operating the web interface. Derive current guild membership, capabilities, presentation, and other changing facts from current backend truth rather than embedding those facts permanently into the session identity.

Signing out ends the session. It does not alter the subject, character continuity, selected main, Discord association, or historical participation.

## Capability

A capability is Guild Operations' translation of current authority into an application-level permission.

Capabilities are not another identity object. They are derived operational authority used to answer questions such as whether the current subject may perform a particular guild operation.

Today, rank-derived capabilities use current controlled roster membership and the highest-authority applicable rank rather than the selected main.

### Intended use

Prefer explicit capabilities at operation boundaries rather than scattering numeric rank comparisons through product features.

This lets Blizzard remain authoritative for current rank while Guild Operations remains authoritative for what a rank permits in this application.

Capabilities should be introduced because a real operation needs them, not to construct a speculative permission taxonomy.

## How these objects fit together

The current useful mental model is:

```text
Subject
├── Blizzard principal / account authority
├── WoW account(s)
│   └── controlled Character(s)
├── selected main ─────────────► one eligible Character
├── optional Discord identity
└── current derived capabilities

Controlled Character(s)
        ∩
current Blizzard guild roster
        ↓
current membership + current rank context
```

This is intentionally not a universal identity graph. It is the minimum structure that has proven useful for operating this guild outside WoW.

## Choosing the right coordinate for a new feature

When a participation feature needs to record or act on a member, start by asking what the fact actually belongs to.

**Usually use the subject** when the fact should survive changes in main character, Discord account, character name, or current membership.

**Use a character as well** when the specific WoW character is materially part of the event or claim being recorded.

**Use current guild membership/rank** when the operation needs present-day Blizzard guild authority.

**Use the selected main** for default presentation, not authorization or continuity.

**Use Discord identity** to resolve a Discord interaction back to the subject, not as an alternate owner of the operation.

**Use capabilities** to express whether the resolved subject may perform the Guild Operations action.

A feature may legitimately involve several of these at once. The important part is not to collapse them simply because they happen to describe the same human at one moment.

## Guidance, not a finished ontology

These boundaries reflect decisions made while establishing the first working member model and interfaces. They are deliberately specific to the needs of OH CRIT I Pulled! and Guild Operations.

Future participation features should reuse these objects where the fit is natural. They should not be distorted to preserve this document if concrete behavior demonstrates that another boundary is needed.

Likewise, do not add more identity-shaped objects merely because another abstraction can be imagined.

The working preference is:

> Use the distinctions we have already earned. Add another only when a real guild activity proves that we need it.
