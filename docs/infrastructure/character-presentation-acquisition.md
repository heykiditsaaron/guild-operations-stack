# Character Presentation Acquisition

Character presentation acquisition is reusable infrastructure for observing richer Blizzard profile and media state for explicitly selected Characters.

It does not decide Character control, roster membership, or eligibility. Those meanings are defined outside this facility.

## Character coordinate

A Character is addressed by:

```text
region + realm_id + character_id
```

Name, realm presentation, level, class, race, specialization, and media URLs are mutable observations.

## Shared primitive

`acquireCharacterPresentation()` accepts explicit targets containing:

- canonical Character coordinate;
- Character name and realm slug required by Blizzard Character APIs;
- whether profile acquisition is required;
- whether media acquisition is required.

For those targets it owns:

- Blizzard application-token acquisition;
- bounded concurrency;
- Character Profile and Character Media GETs;
- corroboration that returned coordinates match the requested Character;
- persistence of successful observations;
- independent acquisition-attempt recording;
- structured profile/media success and failure reporting.

Profile and media are independent resources. A media failure does not discard a successful profile observation.

Guild Operations stores Blizzard media URLs, not the Blizzard media assets themselves.

## Guild-roster wrapper

`enrichGuildCharacters()` selects from the persisted current guild roster, optionally intersects explicit Character coordinates with that roster, derives Blizzard API locators, and delegates to the shared primitive.

With no explicit targets it can operate across the current roster. `npm run guild:enrich` remains the operator CLI for that behavior.

Ordinary [`guild-refresh.md`](guild-refresh.md) selects only Characters requiring follow-up rather than blindly sweeping the roster.

## Account self refresh

[`blizzard-account-authority.md`](blizzard-account-authority.md) calls the shared primitive after self refresh has independently selected Characters satisfying current control ∩ current roster.

Self refresh requests both profile and media for each eligible Character.

## Request behavior

Default concurrency is 8 workers; maximum accepted concurrency is 20.

Character Profile and Character Media authority GETs use the shared [`blizzard-request-boundary.md`](blizzard-request-boundary.md). Structured results report profile and media success/failure independently and count actual Blizzard requests including retries.

## Safety boundary

Presentation failure never removes a Character from the guild roster, changes a Guildie's established Character-control observation, or grants/revokes Guild Operations eligibility.
