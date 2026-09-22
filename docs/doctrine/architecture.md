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

## Application contracts

Global machinery is the canonical application substrate for state and relationships that belong to Guild Operations as a whole.

Authoritative persistence and external observations are translated into named application contracts before consumers interpret them. Internal and external consumers depend on the same application meanings. Web presentation, Discord integrations, schedulers, administrative tooling, modules, and REST interfaces may express or invoke those contracts differently, but they must not independently reconstruct alternate versions of the same truth.

The dependency direction is:

```text
external authority / persistence
            ↓
    application contracts
            ↓
        consumers
```

A consumer should not need to know how state is persisted in order to use it correctly. Direct persistence access is appropriate inside the machinery that owns and establishes a contract; it is not an alternate contract for downstream consumers.

REST preparedness is a consequence of this coherence rather than a separate architecture. The promoted global REST namespace is `/api/v1`; it serializes and authorizes established application contracts rather than introducing a second interpretation of Guild Operations state. Resources and operations are added only when concrete consumer pressure earns them.

Concrete shared infrastructure may accept projections from an owning procedure. Calendar points and Operational Records are examples: their contracts define the shared meaning accepted by the infrastructure without transferring ownership of the underlying producer truth.

Do not introduce a generic application framework, universal object model, or speculative contract registry to enforce this rule. Establish concrete contracts as actual state and relationships require them.

## Semantic ownership and persistence

Persistence ownership follows semantic ownership.

A fact is not globally owned merely because it is stored in the same database, referenced by many consumers, or projected through shared infrastructure. Guild Operations globally owns durable application facts whose meaning belongs to the application as a whole. A concrete module owns durable facts created by its own procedure. Shared infrastructure may own storage and enforcement of its own contract while a producer remains authoritative for the truth contributed through it.

Persisting an external observation does not transfer authority from the system that established it. Blizzard observations may be retained by Guild Operations while Blizzard remains authoritative for the underlying Blizzard-owned facts.

Derived state should not become a second independently persisted source of authority merely because it is useful. Historical procedure facts may be persisted by the procedure that established them without becoming mutable sources of current identity, membership, or rank truth.

Persistence names actual objects and relationships. **Subject** is contextual language, not a persisted object category or universal coordinate.

When deciding where durable state belongs, ask what concrete fact is being persisted, who owns its meaning, whether it is authoritative or observed, whether an existing owner should be referenced rather than duplicated, and whether shared storage has actually been earned. Place state with its semantic owner rather than whichever code path happens to write it first.

Current transactional and operational persistence mechanics belong under [`../infrastructure/`](../infrastructure/).

## Semantic emissions and transport

A **semantic emission** is a publication that a meaningful application occurrence happened. The producer owns the occurrence and identifies it through an application-wide semantic code and authoritative coordinates. An emission is not created for a particular consumer and does not encode the work a consumer should perform. A valid emission may currently have zero, one, or many interested consumers.

Emissions have two earned production mechanisms:

- **operational production** — a meaningful occurrence is produced by an authoritative application operation or observed transition;
- **temporal production** — a meaningful occurrence is produced when authoritative state crosses a domain-defined temporal threshold.

The producer owns whether an operational event or temporal threshold is semantically significant enough to emit. Temporal production does not transfer ownership of the threshold's meaning into scheduling machinery.

Once produced, both kinds enter the same transport boundary:

```text
operational event ────┐
                      ├── emission → transport → interested consumers
temporal threshold ───┘
```

**Emission transport** begins when a producer publishes an emission and ends when that emission has been handed to each interested consumer. Transport owns routing and reliable receipt. Reliability may mature from direct in-process invocation to durable acknowledgement, retry, and recovery as concrete delivery pressure requires; those mechanics must not change the semantic meaning of emissions or transfer producer authority into transport.

Operational publication must not depend on a second best-effort step after authoritative state commits. When an authoritative operation and its semantic emission are persisted by the same application database, the authoritative mutation and durable publication are committed atomically. Consumer delivery remains downstream of that commit. This closes the loss window between committed domain truth and publication without making consumer work part of the domain transaction. Temporal producers must establish an equivalent durable publication boundary when they are implemented.

Transport implementations and consumers require stable identities once reliability needs durable delivery coordinates. Transport identity distinguishes the mechanism responsible for carrying a publication; consumer identity distinguishes the independently interested recipient whose receipt may need to be tracked. Publication identity may likewise be introduced as transport-owned infrastructure when retries must distinguish repeated delivery of one publication from a separately produced occurrence. These identities are infrastructure coordinates, not domain meaning, and must not be encoded into producer-owned semantic codes or authoritative subject coordinates.

Consumers own all work after receipt. Calendar reconciliation, Discord projection or mutation, push notification, audience resolution, and other consumer-specific consequences remain concerns of those consumers and their adapters. From the transport boundary, Calendar, Discord, Push, and future consumers are the same class of participant: independently interested consumers of semantic emissions. Future consumers may pressure the transport design without requiring placeholder adapters, registrations, configuration, or persistence before those consumers actually exist.

Transport does not require every emission to have a consumer, and consumer usefulness does not itself establish producer meaning. Concrete consumer pressure may reveal a meaningful occurrence worth publishing, but the resulting emission describes the producer-owned occurrence rather than the requesting consumer's desired action.

Do not introduce a generic event domain, notification domain, audience framework, or scheduler merely to implement transport. Production, transport, and consumption remain distinct responsibilities even when their first implementation is small.

## Member and authority model

Guild Operations deliberately distinguishes durable Guildie continuity from Blizzard account authority, WoW accounts, Characters, current roster observations, selected-main presentation, optional Discord association, and derived capabilities.

These concepts must not be collapsed merely because they currently describe the same human.

The canonical member and organizational-authority model lives in [`member-objects.md`](member-objects.md).

## Subject is contextual language

Guild Operations has no universal persisted domain object called **Subject**.

A subject is only the object currently being designated by a statement, question, event, or operation. Subjecthood creates no durable coordinate, ownership, persistence, authorization, or identity semantics of its own.

Persist and name the actual object or relationship involved. Do not introduce a generic `subject_id` as a domain shortcut.

## Recognition over profile completeness

Character presentation should favor recognition over profile completeness.

Useful recognition cues currently include Character name, class or active specialization, realm, and current guild rank. Additional Blizzard data should be introduced when a concrete guild workflow requires it, not merely because Blizzard exposes it.

> Prepare the seam, not the speculative feature.

## Time

All newly persisted values representing instants in time use **Unix timestamps**. Human-readable date, time, and timezone are presentation concerns. Local wall-clock input must be converted before persistence, and server/container timezone must not become application policy.

A temporal range uses two Unix values; an instant uses one. The owning contract defines their semantic meaning rather than introducing a speculative generic time framework.

Legacy timestamp columns predating this rule are conformity debt. They do not weaken the rule for new persistence and should not trigger unrelated wholesale migrations.

## Modules and concrete pressure

Concrete guild capabilities are the product pressure that should drive architecture.

A module owns a concrete capability and its procedure. Shared machinery may project, organize, authorize, inspect, or otherwise support module-owned truth without silently becoming the owner of that truth.

Shared abstractions should be introduced only after multiple real features demonstrate the need.

> Build the guild activity. Let the common machinery reveal itself under pressure.

Application-wide module invariants live in [`module-conformity.md`](module-conformity.md). Guild Activity is one specialized semantic family governed by [`guild-activity.md`](guild-activity.md).

Calendar and activity-discovery Offerings are current examples of earned shared presentation infrastructure. Calendar is not a Guild Activity module; it projects temporal truth owned elsewhere. Their operational contracts live under [`../infrastructure/`](../infrastructure/).

## Interface model

Interfaces are projections and interaction surfaces over backend truth. No interface should become the sole keeper of meaningful guild operational state.

Member-facing context should help users recognize who is acting and what they may do without turning Guild Operations into a generic profile surface.

Current web implementation guidance lives in [`../infrastructure/web-rendering.md`](../infrastructure/web-rendering.md).

## Model maturity

Identity and authority machinery are infrastructure, not the product destination. The current foundation is intentionally sufficient rather than exhaustive.

When a new feature creates tension, prefer the smallest concrete change that lets the feature work correctly. Add another shared distinction only when real use proves it necessary.

## Documentation rule

Doctrine records durable meaning and design constraints. Current machinery belongs in infrastructure documentation.

Infrastructure may change substantially without changing doctrine; when doctrine itself changes, the project has changed what it believes the system should mean.
