# Member Objects

This document records the current working understanding of Guild Operations' member-related objects and how they should be used.

It is guidance rather than frozen ontology. Concrete guild participation features are allowed to pressure these boundaries, but the distinctions below have now proven operationally useful.

## The core distinction

Guild Operations needs to separate recognition from current guild participation.

```text
Subject
= durable recognition coordinate

Character
= durable WoW character object

Guildie
= durable human guild-member representation

Character roster
= Blizzard-observed current in-game guild membership

Guildie roster
= Guild Operations-derived current organizational membership
```

The Character roster determines the Guildie roster through current character-control relationships.

## Subject

A **Subject** is Guild Operations' durable recognition coordinate for the same human across sessions, controlled Characters, selected-main changes, and optional Discord association.

Subject is infrastructure. It is not the guild-facing name for the human member.

A Subject is established from Blizzard-authenticated WoW continuity. Discord, a selected main, a character name, or guild rank never creates the canonical Subject.

Use `subject_id` when a durable internal coordinate is required. Do not infer from that coordinate name that the operation semantically belongs to Subject machinery.

## Blizzard principal and account authority

The Blizzard-authenticated principal establishes that the person operating the browser controls the corresponding Blizzard account context.

The root external coordinate is currently:

```text
region + Blizzard authenticated principal identifier
```

The authenticated account profile reveals subordinate WoW accounts and Characters.

Blizzard account authority answers:

> What Characters does this Subject currently control?

It does not itself answer whether the Guildie currently has a participation surface in OH CRIT I Pulled!.

## WoW account

A WoW account preserves Blizzard's observed account structure between a Subject and its Characters. It is not currently a meaningful member-facing Guild Operations object.

## Character

A **Character** is a durable WoW character object.

The durable coordinate is:

```text
region + realm_id + character_id
```

A Character can be known through Blizzard's guild roster even when no Guild Operations Subject has yet demonstrated control of it.

For guild operations, a Character is either currently on the Blizzard guild roster with a Blizzard-owned numeric rank, or it is not. Extra `character-member` or `character-membership` nouns are unnecessary to describe that state.

Characters remain the primary recognition surface because they are how guildmates commonly recognize one another in WoW. Favor useful recognition cues over Armory-style profile completeness:

- character name;
- class / active specialization;
- realm;
- current guild rank.

## Character roster

The **Character roster** is dictated by the actual in-game guild environment and observed through Blizzard.

```text
WoW / Blizzard
    ↓
current guild Character roster
```

Blizzard owns whether a Character is currently on that roster and the Character's numeric guild rank. Guild Operations persists and reconciles those observations without converting them into permanent identity.

A Character leaving the roster does not erase the Character or historical Guild Operations activity involving it.

## Guildie

A **Guildie** is Guild Operations' durable representation of the human guild member who controls Characters.

A Guildie is resolved through a Subject rather than receiving a second independent identity coordinate. `subject_id` is therefore the current durable lookup coordinate for the Guildie.

Guildie continuity is non-destructive. A Guildie remains a known Guildie even when none of their controlled Characters are currently present on the Character roster.

Guildie-owned or Guildie-facing state includes:

- controlled Characters;
- selected main;
- optional Discord association;
- current organizational membership;
- effective current guild rank;
- guild participation and history.

## Guildie roster and participation surface

The **Guildie roster** is Guild Operations-derived organizational membership.

```text
Guildie's currently controlled Characters
                ∩
current Blizzard Character roster
                ↓
current Guildie organizational membership
```

The invariant is:

```text
at least one controlled roster Character
    → Guildie has a current participation surface

zero controlled roster Characters
    → Guildie remains recognized
    → no current guild participation surface
    → no current rank-derived authority
```

This state is not destructive.

`guildie.joined` means the Guildie transitioned from no current participation surface to having one. It does not mean the Guildie or Subject was created.

`guildie.left` means the Guildie transitioned from having a current participation surface to having none. It is not a closeout, deletion, retirement, or historical rewrite.

A Guildie's current participation surface can appear or disappear because the Blizzard Character roster changed or because Blizzard account reconciliation changed which Characters the Subject currently controls.

## Guild rank

Blizzard owns the numeric rank attached to each current roster Character. Guild Operations owns what that rank means outside WoW.

A Guildie's effective rank is the highest-authority rank among all currently controlled Characters on the current Character roster. Under Blizzard's current rank ordering, lower numeric rank index means higher authority.

The selected main does not determine authority.

Rank is both an authorization input and a recognition cue. Keep those uses conceptually separate.

## Selected main

The **selected main** is a Guildie presentation preference keyed through the Guildie's Subject.

It answers:

> Which eligible guild Character does this Guildie want Guild Operations to present them through?

It does not establish Subject recognition, Character control, current Guildie organizational membership, or effective rank.

A stored selection may remain recorded after that Character becomes ineligible. Current presentation should simply treat the selection as unavailable until an eligible main is selected again.

## Discord identity

A Discord identity is an optional Guildie association keyed through the durable Subject coordinate.

Discord never creates the Subject or Guildie and grants no authority by itself.

```text
Discord identity ─────┐
                      ├──► Subject ───► Guildie
Blizzard web login ───┘
```

Association remains distinct from Discord server membership, roles, and channels.

## Session

The application session resolves to `subject_id`.

That durable coordinate establishes which Guildie is operating the interface. Current participation surface, rank-derived authority, capabilities, and presentation are derived from current backend truth rather than embedded permanently in session identity.

Signing out ends the session. It does not alter Subject continuity, Guildie continuity, Characters, selected main, Discord association, or historical participation.

## Capability

A capability is Guild Operations' translation of current authority into an application-level permission.

Capabilities are not identity objects. Where current guild authority matters, they derive from the Guildie's current participation surface and effective rank rather than the selected main.

## Current mental model

```text
Subject
= durable recognition coordinate
        │
        ▼
Guildie
├── Blizzard account authority
├── controlled Character(s)
├── selected main
├── optional Discord association
├── participation history
└── current derived capabilities

WoW / Blizzard
        │
        ▼
Character roster
= current Character membership + rank
        │
        └──────────────┐
                       ▼
controlled Characters ∩ Character roster
                       │
                       ▼
                  Guildie roster
             = current organizational membership
               + effective rank
```

## Choosing the right coordinate

Use **Subject** when durable recognition is required.

Use **Character** when the fact genuinely concerns a specific WoW Character.

Use **Guildie** when the fact belongs to the human guild member as understood by Guild Operations.

Use current **Character roster** state when Blizzard-owned in-game guild membership matters.

Use current **Guildie roster** state when Guild Operations organizational participation or rank-derived authority matters.

Use selected main for presentation, not identity or authorization.

Use Discord identity to resolve or project a Guildie through Discord, not as an alternate owner of guild truth.

Use capabilities at operation boundaries when a real operation needs authorization.

## Guidance, not a finished ontology

These distinctions exist because concrete Guild Operations behavior proved they were needed. Do not add another identity-shaped layer merely because one can be imagined.

> Use the distinctions we have already earned. Add another only when a real guild activity proves that we need it.
