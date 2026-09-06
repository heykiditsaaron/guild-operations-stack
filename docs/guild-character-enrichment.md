# Guild Character Enrichment

> **Investigation note: do not consolidate this document yet.**
>
> The documentation-repair audit originally identified this document as an older standalone enrichment model whose durable doctrine could likely be absorbed into `guild-refresh.md`. That consolidation is intentionally deferred while the known self account refresh bug is investigated.
>
> The current self-refresh path reacquires a Guildie's Blizzard account/control observation but does not explicitly invoke Character profile/media acquisition. This document describes presentation acquisition as a separate capability, while `guild-refresh.md` now owns targeted follow-up presentation acquisition after guild-roster reconciliation. Investigate whether the evolution from standalone enrichment to targeted guild refresh left self refresh without a responsible path for bringing newly controlled or newly relevant Characters' presentation observations up to date.
>
> Do not assume the answer is for self refresh to invoke guild refresh: account-control authority and guild-roster authority are different Blizzard observations. Determine instead whether an existing Character acquisition capability should be reused directly, or whether the implementations reveal a smaller shared reconciliation seam. Preserve the distinction that roster authority, account-control authority, and Character presentation observations do not become the same fact merely because one change may require follow-up acquisition of another.

Guild roster authority and Character presentation are separate concerns.

The Blizzard guild roster establishes which Characters are currently members of OH CRIT I Pulled!. Character enrichment observes richer Blizzard profile and media data for those current roster Characters.

## Canonical coordinate

A Character remains identified by:

```text
region + realm_id + character_id
```

Names, realm presentation, level, class, race, specialization, and media URLs are observed presentation state and may change without changing Character continuity.

## Enrichment scope

The current enrichment pass operates across the persisted current guild roster, not only Characters controlled by authenticated Guildies.

For each current roster Character it attempts:

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
- single-Character or missing-observation refresh

Those invocation surfaces must not duplicate enrichment semantics or make Character presentation responsible for guild-membership authority.

## Authority boundary

```text
Guild roster sync
    = current Blizzard Character guild-membership observation

Character enrichment
    = Blizzard Character presentation observation

Guild Operations projections
    = presentation of those persisted facts
```

Failure to enrich a Character never removes the Character from the guild roster and never changes a Guildie's established Character-control authority.

`Subject` has no role in Character enrichment or control persistence; it is contextual language only.
