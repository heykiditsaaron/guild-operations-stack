# Architecture

## Purpose

Guild Operations exists specifically for **OH CRIT I Pulled!** as the guild's interactive participation and operation layer outside World of Warcraft.

World of Warcraft and Discord remain primary places where the guild exists and communicates. Guild Operations provides a neutral, knowledgeable place where guild-owned operational truth can be established and then expressed appropriately across those interfaces.

It is not an Armory replacement, a generic identity platform, a general-purpose guild-management product, or an attempt to move the guild out of WoW or Discord.

A useful product test is:

> Does this help establish authority to participate, enable guild participation, operate that participation, or preserve its history?

If not, it probably does not belong.

## Architectural center

The backend owns singular truthful operational state.

Web, Discord, and future WoW-facing integrations are projections or interaction surfaces over that truth. They may express the same facts differently because their media differ, but they must not become independent owners of the same operational facts.

Authority remains with whoever can legitimately establish the fact:

- **Blizzard** owns authenticated account control, current WoW guild membership, Characters, and numeric guild rank.
- **Guild Operations** owns meanings and procedures established by the guild outside WoW.
- **Human guild members** remain authoritative for judgments no machine can legitimately make.

Guild Operations should automate procedure, enforcement, recording, resolution, and presentation where useful. It should not manufacture authority merely because software could make a decision.

## Member and authority model

Guild Operations deliberately distinguishes durable Guildie continuity from Blizzard account authority, WoW accounts, Characters, current roster observations, selected-main presentation, optional Discord association, and derived capabilities.

These concepts must not be collapsed merely because they currently describe the same human.

The canonical member model lives in [`member-objects.md`](member-objects.md). Current Guildie participation and effective rank are defined in [`guild-authority.md`](guild-authority.md).

## Subject is contextual language

Guild Operations has no universal persisted domain object called **Subject**.

A subject is only the object currently being designated by a statement, question, event, or operation. Subjecthood creates no durable coordinate, ownership, persistence, authorization, or identity semantics of its own.

Persist and name the actual object or relationship involved. Do not introduce a generic `subject_id` as a domain shortcut.

## Recognition over profile completeness

Character presentation should favor recognition over profile completeness.

Useful recognition cues currently include Character name, class or active specialization, realm, and current guild rank. Additional Blizzard data should be introduced when a concrete guild workflow requires it, not merely because Blizzard exposes it.

> Prepare the seam, not the speculative feature.

## Persistence and time

Persistence ownership follows semantic ownership. Durable objects, external observations, guild-owned meaning, and historical participation must remain distinguishable even when they live in one database.

The detailed ownership doctrine is in [`global-persistence.md`](global-persistence.md).

All newly persisted values representing instants in time use **Unix timestamps**. Human-readable date, time, and timezone are presentation concerns. Local wall-clock input must be converted before persistence, and server/container timezone must not become application policy.

A temporal range uses two Unix values; an instant uses one. The owning contract defines their semantic meaning rather than introducing a speculative generic time framework.

## Participation and shared machinery

Concrete guild activities are the product pressure that should drive architecture.

A module owns a concrete participation capability and its procedure. Shared machinery may project, organize, authorize, inspect, or otherwise support module-owned truth without silently becoming the owner of that truth.

Shared abstractions should be introduced only after multiple real features demonstrate the need.

> Build the guild activity. Let the common machinery reveal itself under pressure.

Module design guidance lives in [`module-creation.md`](module-creation.md).

Guild Event Calendar and Guild Event Offerings are current examples of earned shared infrastructure. Their operational contracts live under [`../infrastructure/`](../infrastructure/).

## Interface model

Interfaces are projections and interaction surfaces over backend truth. No interface should become the sole keeper of meaningful guild operational state.

Member-facing context should help users recognize who is acting and what they may do without turning Guild Operations into a generic profile surface.

Current web implementation guidance lives in [`../infrastructure/web-rendering.md`](../infrastructure/web-rendering.md).

## Model maturity

Identity and authority machinery are infrastructure, not the product destination. The current foundation is intentionally sufficient rather than exhaustive.

When a new feature creates tension, prefer the smallest concrete change that lets the feature work correctly. Add another shared distinction only when a real guild activity proves it is necessary.

## Documentation rule

Doctrine records durable meaning and design constraints. Current machinery belongs in infrastructure documentation.

Infrastructure may change substantially without changing this doctrine; when doctrine itself changes, the project has changed what it believes the system should mean.
