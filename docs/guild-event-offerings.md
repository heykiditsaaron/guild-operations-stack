# Guild Event Offerings

## Purpose

The Guild Events shell needs to answer a different question from the Guild Event Calendar.

The Calendar answers:

> What is happening, and when?

The Events shell also needs to answer:

> What kinds of guild participation are offered here?

A **Guild Event Offering** is the small semantic contribution a module makes so the shared Events shell can promote that enduring participation offering even when no concrete occurrence is currently live or scheduled.

The governing responsibility is:

> **The Events shell promotes participation offerings. The module explains them.**

An Offering is therefore not a substitute for the module's informational surface, procedure, rules, administration, history, eligibility logic, or Calendar Listings.

## Contract

The current contract is deliberately small:

```ts
type GuildEventOffering = {
  offeringId: string;
  title: string;
  tagline: string;
  destination: string;
};
```

### `offeringId`

`offeringId` is the stable identifier for the offering contribution inside the Guild Events shell.

It identifies the enduring participation offering, not a concrete scheduled occurrence. For example, a raffle module may expose one `raffle` offering while individual raffle rounds remain separate concrete occurrences on the Guild Event Calendar.

Offering identifiers must be unique among registered Guild Event Offerings.

### `title`

`title` is the member-facing name the shell uses to identify the offering.

It should identify the activity, not explain its procedure.

### `tagline`

`tagline` is short promotional copy intended to make the offering understandable and inviting at a glance.

It is intentionally not a summary of rules or participation procedure. The Events shell should promote the activity; the module's own destination should explain it.

### `destination`

`destination` is the member-facing location where the module explains the offering and provides the appropriate participation surface.

The shell uses the destination to move a member from discovery into the module-owned experience. Route hierarchy does not transfer implementation or domain ownership to the shell.

## Registration

Offerings are registered through the shared contract under:

```text
src/guild-events/offerings/
```

Registration is application composition, not persisted guild truth. The registry exists so shared shell consumers can discover module contributions without hardcoding module inventories into the Events page itself.

A module owns the semantic values it contributes. The shell owns how registered Offerings are arranged and presented.

Registration order is not presentation policy. Consumers may organize Offerings according to their own presentation needs.

## Presentation ownership

The Offering contract describes semantic promotional material, not card markup or visual layout.

Modules must not register HTML, CSS, arbitrary presentation metadata, or shell layout instructions through this contract.

The Events shell owns the promotional treatment. This allows the shell to render Offerings as contextual, eye-catching participation promotions while keeping a coherent shared page grammar.

The current contract does **not** require artwork. Visual enrichment such as module-specific artwork may be added later if concrete presentation work proves that the shell needs another semantic coordinate. It should not be added merely because a richer card can be imagined.

## Relationship to the Guild Event Calendar

Guild Event Offerings and Guild Event Calendar Listings answer independent questions:

```text
Guild Event Offering
    → What participation does the guild offer?

Guild Event Calendar Listing
    → What concrete occurrence happens when?
```

An Offering may exist with zero Calendar Listings.

A Calendar Listing may describe a concrete occurrence of an Offering, but the Calendar does not establish that the enduring Offering exists and the Offering does not establish that any occurrence is scheduled.

For example:

```text
Raffle Offering
    → Raffle is something the guild does.

September Raffle Calendar Listing
    → A particular raffle round occurs at a particular time.
```

Neither contract should infer the other's truth.

## Ownership boundary

The shared Events shell owns:

- the participation-offering discovery surface;
- promotional card or equivalent presentation grammar;
- arrangement and ordering of Offering contributions; and
- movement from discovery into a module-owned destination.

The module owns:

- whether it exposes an Offering contribution;
- the Offering's title, tagline, and destination;
- the participation capability itself;
- explanation and rules;
- participation procedure;
- module-specific eligibility and authority;
- administration; and
- historical results.

The Guild Event Calendar separately owns shared temporal-discovery infrastructure for concrete occurrences.

## Negative boundary

The Offering contract is not a generic module capability registry.

Do not use it to register every action or internal capability a module supports. Operations such as approving a raffle claim, drawing a winner, editing a future round, or cancelling a round remain module procedure rather than Guild Event Offerings.

The contract also does not currently include:

- rules;
- eligibility;
- status;
- scheduling;
- historical results;
- administrative destinations;
- notification policy;
- arbitrary metadata;
- artwork requirements; or
- presentation markup.

Add another coordinate only when real shell presentation or another concrete consumer demonstrates that it is required.

## Current shape

Conceptually:

```text
Module
├── owns a guild participation capability
├── explains and operates that capability
└── registers an enduring participation offering
        ↓
Guild Event Offering Registry
        ↓
Events shell consumer
├── promotes the offering
└── routes the member into the module-owned destination
```

Alongside it:

```text
Module occurrence truth
        ↓
Guild Event Calendar Listing
        ↓
Guild Event Calendar consumer
```

These are complementary shared surfaces, not layers of one generalized Event framework.
