# Member Objects

This document records the current working understanding of Guild Operations' member-related objects and how they should be used.

It is guidance rather than frozen ontology. Concrete guild participation features are allowed to pressure these boundaries, but the distinctions below have now proven operationally useful.

## Subject is contextual, not an object

Guild Operations does not have a domain object called `Subject` and does not persist one.

**Subject** is contextual language: it designates an already existing object in relation to a question, statement, event, or operation.

For example:

- the subject of "what event happens tomorrow?" may be a raffle round;
- the subject of "who won the raffle?" may be a Character;
- the Guildie who controls that Character may be relevant attribution, but that does not make Guildie a universal Subject object.

Persist and name the actual object or relationship: `guildie_id`, Character coordinates, `round_id`, `claim_id`, `guild_event_id`, and similarly specific coordinates. Do not introduce a generic `subject_id` as a domain or persistence coordinate.

## The two guild membership realms

OH CRIT I Pulled! exists in two related organizational realms:

```text
WoW / Blizzard-established guild organization
    member object: Character

real-world guild organization around that WoW guild
    member object: Guildie
```

Blizzard establishes the first organization and remains authoritative for its current Character roster and numeric ranks.

Guild Operations represents the second organization: the people who administer and participate around the WoW guild, together with the guild-created operational truth that Blizzard does not own.

## Guildie

A **Guildie** is Guild Operations' durable representation of the real-world guild organizational member: the account holder and control representative for their WoW Characters.

The durable Guild Operations coordinate is:

```text
guildie_id
```

Blizzard authentication establishes or resolves the Guildie through Blizzard account authority. The authenticated account profile reveals subordinate WoW accounts and controlled Characters.

Guildie continuity is non-destructive. A Guildie remains known even when none of their currently controlled Characters are present on the Character roster.

Guildie-owned or Guildie-facing state includes:

- Blizzard account authority used to resolve that Guildie;
- controlled Characters;
- selected main;
- optional Discord association;
- current organizational participation;
- effective current guild rank;
- guild participation and history when the participation fact genuinely belongs to the Guildie.

## Blizzard principal and account authority

The Blizzard-authenticated principal establishes that the browser operator controls the corresponding Blizzard account context.

The root external coordinate is currently:

```text
region + Blizzard authenticated principal identifier
```

That authority resolves one Guildie and reveals the WoW accounts and Characters currently controlled through that Blizzard account context.

Blizzard account authority answers:

> Which Characters does this Guildie currently control?

It does not by itself answer whether those Characters are currently members of OH CRIT I Pulled! or whether the Guildie currently has rank-derived organizational authority.

## WoW account

A WoW account preserves Blizzard's observed account structure between a Guildie and their Characters. It is not currently a meaningful member-facing Guild Operations object.

## Character

A **Character** is a durable WoW character object and the member object of Blizzard's guild organization.

The durable Blizzard Character coordinate is:

```text
region + realm_id + character_id
```

A Character can be known through Blizzard's guild roster even when no Guildie has yet demonstrated control of it through Guild Operations.

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

Blizzard owns whether a Character is currently on that roster and the Character's numeric guild rank. Guild Operations persists and reconciles those observations without converting them into permanent organizational membership.

A Character leaving the roster does not erase the Character or historical Guild Operations activity involving it.

## Guildie roster and participation surface

The **Guildie roster** is Guild Operations-derived current organizational participation.

```text
Guildie's currently controlled Characters
                ∩
current Blizzard Character roster
                ↓
current Guildie organizational participation
```

The same intersection defines which Characters a Guildie may currently manage or represent as inside Guild Operations:

```text
currently controlled by Guildie
        ∩
currently present in Blizzard guild roster
        ↓
eligible Guild Operations Character
```

Control alone is insufficient. Guild-roster membership alone is insufficient. Character profile or media availability is also insufficient and cannot grant eligibility.

Guild Operations may retain account-control observations for Characters outside the current guild roster, but those Characters do not become usable or presentable Guildie Characters until Blizzard guild-roster authority also establishes current membership.

The invariant is:

```text
at least one controlled roster Character
    → Guildie has a current participation surface

zero controlled roster Characters
    → Guildie remains known
    → no current guild participation surface
    → no current rank-derived authority
```

This state is derived and non-destructive; it is not a second persisted source of membership truth.

`guildie.joined` means the Guildie transitioned from no current participation surface to having one. It does not mean the Guildie object was created.

`guildie.left` means the Guildie transitioned from having a current participation surface to having none. It is not a closeout, deletion, retirement, or historical rewrite.

A Guildie's current participation surface can appear or disappear because the Blizzard Character roster changed or because Blizzard account reconciliation changed which Characters the Guildie currently controls.

## Guild rank

Blizzard owns the numeric rank attached to each current roster Character. Guild Operations owns what that rank means outside WoW.

A Guildie's effective rank is the highest-authority rank among all currently controlled Characters on the current Character roster. Under Blizzard's current rank ordering, lower numeric rank index means higher authority.

The selected main does not determine authority.

Rank is both an authorization input and a recognition cue. Keep those uses conceptually separate.

## Selected main

The **selected main** is a Guildie presentation preference.

It answers:

> Which eligible guild Character does this Guildie want Guild Operations to present them through?

It does not establish Guildie continuity, Character control, current Guildie organizational participation, or effective rank.

A stored selection may remain recorded after that Character becomes ineligible. Current presentation should simply treat the selection as unavailable until an eligible main is selected again.

## Discord association

A Discord identity is an optional association to an existing Guildie.

Discord never creates the canonical Guildie and grants no authority by itself.

```text
Blizzard account authority ──► Guildie ◄── optional Discord association
                                │
                                └── controls Character(s)
```

Association remains distinct from Discord server membership, roles, and channels.

## Session

The application session resolves to `guildie_id`.

That coordinate establishes which Guildie is operating the interface. Current participation surface, rank-derived authority, capabilities, and presentation are derived from current backend truth rather than embedded permanently in the session.

Signing out ends the session. It does not alter Guildie continuity, Characters, selected main, Discord association, or historical participation.

## Capability

A capability is Guild Operations' translation of current authority into an application-level permission.

Capabilities are not identity objects. Where current guild authority matters, they derive from the Guildie's current participation surface and effective rank rather than the selected main.

## Current mental model

```text
Blizzard account authority
        │
        ▼
Guildie
├── guildie_id
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
             = current organizational participation
               + effective rank
```

## Choosing the right coordinate

Use **Guildie** when the fact genuinely belongs to the real-world guild organizational member.

Use **Character** when the fact genuinely concerns a specific WoW Character or its participation in Blizzard's guild organization.

Use current **Character roster** state when Blizzard-owned in-game guild membership matters.

Use current **Guildie roster** state when Guild Operations organizational participation or rank-derived authority matters.

Use the controlled-Character ∩ current-roster intersection when deciding which Characters a Guildie may manage or represent as in Guild Operations.

Use selected main for presentation, not identity or authorization.

Use Discord identity to resolve or project an existing Guildie through Discord, not as an alternate owner of guild truth.

Use capabilities at operation boundaries when a real operation needs authorization.

Use the word **subject** only contextually when ordinary language requires identifying what a statement or relation is about. Do not turn that contextual role into a generic domain object or persistence coordinate.

## Guidance, not a finished ontology

These distinctions exist because concrete Guild Operations behavior proved they were needed. Do not add another identity-shaped layer merely because one can be imagined.

> Use the distinctions we have already earned. Add another only when a real guild activity proves that we need it.
