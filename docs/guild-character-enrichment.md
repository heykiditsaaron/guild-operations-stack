# Character presentation acquisition

Character presentation acquisition observes richer Blizzard profile and media state for specifically identified Characters. It is a reusable acquisition capability, not an authority source for Character control or guild membership.

## Canonical coordinate

A Character remains identified by:

```text
region + realm_id + character_id
```

Names, realm presentation, level, class, race, specialization, and media URLs are observed presentation state and may change without changing Character continuity.

## Responsibility boundary

Three questions remain separate:

```text
Guildie account/control reconciliation
    = which Characters this Guildie currently controls

Guild roster reconciliation
    = which Characters are currently members of the guild

Character presentation acquisition
    = what richer Blizzard profile/media state can be observed
      for Characters already selected by another procedure
```

Presentation acquisition does not inspect account control or determine guild membership. It cannot make a Character eligible for Guild Operations and it does not widen the target set supplied by its caller.

The caller owns why a Character is relevant and which presentation resources need acquisition.

## Shared acquisition primitive

`acquireCharacterPresentation()` accepts explicit Character targets containing:

- canonical Character coordinate;
- Character name and realm slug needed to address Blizzard's Character APIs;
- whether profile acquisition is required;
- whether media acquisition is required.

For those targets it owns:

- Blizzard application-token acquisition;
- bounded concurrency;
- shared Blizzard request pacing and retry/backoff behavior;
- Character Profile and Character Media requests;
- corroboration that returned Blizzard coordinates match the requested Character;
- persistence of successful profile and media observations;
- independent acquisition-attempt recording;
- structured success and failure reporting.

Profile and media observations are independent. A media failure does not discard a successful profile observation, and a presentation failure does not alter account-control or guild-roster authority.

The complete Blizzard profile and media payloads are retained as observations alongside normalized fields needed by Guild Operations projections.

Guild Operations stores Blizzard media URLs; it does not ingest or own Blizzard media assets.

## Guild-roster wrapper

`enrichGuildCharacters()` remains the guild-specific wrapper around the shared acquisition primitive.

It selects from the persisted current guild roster, intersects any explicitly supplied Character coordinates with that roster, derives the Blizzard API locator from the roster observation, and delegates the resulting targets to `acquireCharacterPresentation()`.

With no explicit targets, the wrapper can operate across the current roster. The `npm run guild:enrich` CLI remains an operator invocation surface for that behavior.

Ordinary `refreshGuildAuthority()` does not perform a blind full-roster enrichment sweep. After roster reconciliation it determines which current roster Characters actually need profile or media work and invokes the guild-specific wrapper only for those targets.

## Self account refresh

Self account refresh reuses the shared acquisition primitive directly rather than invoking guild refresh or the guild-roster enrichment wrapper.

After account/control reconciliation it selects Characters that satisfy:

```text
currently controlled by the Guildie
        ∩
currently present in the persisted guild roster
```

It uses the fresh account observation for the Character name and realm slug, then explicitly requests both profile and media acquisition for each eligible Character.

This reuse does not transfer eligibility decisions into presentation acquisition. Self refresh establishes the target set before calling the acquisition primitive.

## Request behavior

Default acquisition concurrency is 8 workers, with a maximum accepted concurrency of 20.

All Blizzard authority GET requests pass through the shared request gate, which currently limits requests to 10 per second. The request boundary retries HTTP 429 and 5xx responses, honors `Retry-After` when supplied, and otherwise applies exponential backoff.

Structured results report profile and media success/failure independently and count actual Blizzard requests, including retries.

## Authority invariant

Failure to acquire presentation never removes a Character from the guild roster, never changes a Guildie's established Character-control observation, and never grants or revokes Guild Operations Character eligibility.
