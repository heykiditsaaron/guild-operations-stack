# Guild Event Offerings

Guild Event Offerings are shared infrastructure for advertising enduring participation capabilities through the Events shell even when no concrete occurrence is scheduled.

Use an Offering when the Events shell should be able to answer:

> What kinds of guild participation are offered here?

This is separate from Calendar infrastructure, which answers what concrete occurrence happens when.

## Contract

```ts
type GuildEventOfferingArtwork =
  | { kind: "asset"; asset: string }
  | { kind: "url"; url: string };

type GuildEventOffering = {
  offeringId: string;
  title: string;
  tagline: string;
  destination: string;
  artwork?: GuildEventOfferingArtwork;
};
```

### `offeringId`

Stable identifier for the enduring offering contribution. It is not an occurrence identifier and must be unique among registered Offerings.

### `title`

Member-facing activity name used by the shell.

### `tagline`

Short promotional copy suitable for discovery. It should not attempt to encode the activity's rules or procedure.

### `destination`

Member-facing destination where the owning capability explains and operates participation.

### `artwork`

Optional recognition artwork. `kind: "asset"` identifies an application asset; `kind: "url"` identifies an external image URL.

Artwork does not carry layout instructions. Consumers own sizing, cropping, positioning, fallback, and other presentation behavior.

## Registration

Offerings are registered under:

```text
src/guild-events/offerings/
```

Registration is application composition rather than persisted guild truth.

The producer owns the semantic values it registers. The Events shell owns arrangement and presentation. Registration order is not presentation policy.

Modules must not register HTML, CSS, arbitrary metadata, or shell layout instructions through the Offering contract.

## Relationship to Calendar

```text
Guild Event Offering
    → What participation does the guild offer?

Guild Event Calendar Listing
    → What concrete occurrence happens when?
```

An Offering may exist with zero Calendar Listings. A Calendar Listing may represent an occurrence related to an Offering, but neither contract establishes the other's truth.

Calendar usage is documented in [`guild-event-calendar.md`](guild-event-calendar.md).

## What belongs in the module

Offering infrastructure does not own:

- participation rules;
- eligibility;
- administration;
- history;
- module procedure;
- scheduling;
- concrete occurrence status;
- notification policy.

Those remain with the owning capability.

## When not to use an Offering

Do not use Offerings as a generic module capability registry. Internal operations, administrative actions, and procedure-specific commands are not enduring participation offerings merely because they exist in a module.

Add another Offering coordinate only when real shell or consumer pressure requires shared discovery meaning.
