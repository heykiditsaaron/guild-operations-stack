# Guild Character Enrichment

Guild roster authority and character presentation are separate concerns.

The Blizzard guild roster establishes which characters are currently members of OH CRIT I Pulled!. Character enrichment observes richer Blizzard profile and media data for those current roster characters.

## Canonical coordinate

A character remains identified by:

```text
region + realm_id + character_id
```

Names, realm presentation, level, class, race, specialization, and media URLs are observed presentation state and may change without changing character continuity.

## Enrichment scope

The current enrichment pass operates across the persisted current guild roster, not only characters controlled by authenticated Guild Operations subjects.

For each current roster character it attempts:

1. Blizzard Character Profile
2. Blizzard Character Media

The profile observation is persisted independently from the media observation. A media failure does not discard a successful profile observation, and enrichment failures do not alter guild roster authority.

The complete Blizzard profile and media payloads are retained as observations alongside normalized fields needed by Guild Operations projections.

Guild Operations stores Blizzard media URLs; it does not ingest or own Blizzard media assets.

## Invocation

The first caller is intentionally manual:

```text
npm run guild:enrich
```

The reusable `enrichGuildCharacters()` service owns acquisition, bounded concurrency, request pacing, retry/backoff, persistence, and structured outcome reporting. The CLI is only an invocation surface.

Default request behavior is deliberately conservative:

- concurrency: 8 workers
- request pacing: 10 requests/second
- retries: up to 4 attempts for 429 and server failures
- `Retry-After` is honored when Blizzard supplies it

The service reports profile and media success/failure independently and counts actual Blizzard requests, including retries.

## Future invocation surfaces

The enrichment service is intended to remain independent of transport so the same capability can later be invoked by:

- a protected operator HTTP endpoint
- scheduled or stale-aware automatic refresh
- single-character or missing-observation refresh

Those invocation surfaces must not duplicate enrichment semantics or make character presentation responsible for guild-membership authority.

## Authority boundary

```text
Guild roster sync
    = current Blizzard guild membership observation

Character enrichment
    = Blizzard character presentation observation

Guild Operations projections
    = presentation of those persisted facts
```

Failure to enrich a character never removes the character from the guild roster and never changes an authenticated subject's character-control authority.
