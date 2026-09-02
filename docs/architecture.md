# Architecture

## Scope

Guild Operations exists specifically for a World of Warcraft guild and its Discord community. It is not a generic identity-linking platform.

The system has two identity domains:

- World of Warcraft
- Discord

World of Warcraft is native. Discord is orbital.

## Canonical subject

The canonical operational subject is established from Blizzard-authenticated World of Warcraft identity.

Conceptually:

```text
Blizzard authentication
        ↓
WoW-rooted subject
├── characters
│   ├── main
│   └── alts
└── Discord identity
```

Discord must never create the root subject. A Discord identity may resolve to an existing WoW-rooted subject after an explicit linking flow.

Changing Discord accounts or changing a selected main character must not create a new operational subject or rewrite historical guild activity.

## Interface model

The backend owns singular truthful operational state. Interfaces present and manipulate that state according to their medium.

Expected interfaces include:

- Web dashboard
- Discord bot / BotGhost integration
- A possible future WoW addon

No interface should become the sole keeper of meaningful guild operational state.

For web access, authentication should begin with Blizzard/Battle.net authorization and resolve the authenticated user to the canonical WoW-rooted subject before establishing the application session.

## Human authority

Guild Operations automates persistence, procedure, visibility, and lifecycle management. It does not manufacture human judgment.

Where a guild workflow requires an officer, attendant, or other authorized person to decide something, the backend should record and constrain that decision rather than pretending to verify facts it cannot authoritatively observe.

## Initial implementation objective

The first implementation capability is:

> Given successful Blizzard authentication, establish or resolve the canonical WoW-rooted subject.

Before fixing the persistence model or field names, verify the current Blizzard OAuth and Account Profile API authority boundaries, including stable identifiers and character ownership exposure.

## Workflow

This repository intentionally uses a lightweight development process. It does not use numbered task documents or development journals. Architecture documentation should preserve only durable decisions that materially constrain later work.
