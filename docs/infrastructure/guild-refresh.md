# Guild Refresh

Guild refresh is the shared reconciliation procedure for Blizzard-owned guild roster state. The doctrine describing how roster truth contributes to Guildie authority lives in [`../doctrine/guild-authority.md`](../doctrine/guild-authority.md).

## What it owns

Guild refresh answers:

> Which Characters are currently members of OH CRIT I Pulled!, and what Blizzard-owned numeric guild rank does each currently hold?

It does not establish Character control and does not make Character presentation authoritative for membership.

## Invocation surfaces

The same reconciliation procedure is used by:

- `npm run guild:sync` — one-shot operator/debug CLI;
- protected `POST /guild/refresh` — manual web/API refresh requiring `guild.refresh`;
- the application-owned automatic guild refresh scheduler.

The scheduler is internal application machinery, not an environment-variable or Docker worker configuration.

## Automatic schedule

Persisted schedule state records:

- enabled state;
- refresh interval in seconds;
- next due Unix instant.

The interval must be an integer of at least 300 seconds.

Schedule behavior:

- enabling schedules the first run one interval from save time;
- changing the interval restarts cadence from save time;
- disabling clears the next due instant;
- re-enabling starts a fresh cadence;
- claiming an automatic occurrence advances next due by the configured interval from claim time;
- failure does not disable later automatic occurrences;
- manual refresh does not move the automatic cadence.

Claiming a due occurrence uses an atomic database update so multiple application processes do not casually claim the same occurrence. Scheduler-triggered refreshes do not overlap within one process.

Manual execution and schedule configuration both require `guild.refresh`. The current policy grants it to Blizzard guild rank indexes 0, 1, and 2 through the shared capability machinery.

## Administrative surface

Guild refresh appears under `/admin` in Guild settings.

The surface exposes:

- current member count from persisted current roster membership;
- `Last reconciled` from the most recent successful persistence of Blizzard guild authority;
- automatic enabled state;
- interval in seconds;
- next due instant rendered in viewer-local time;
- `Refresh now`, which invokes the existing protected endpoint.

## Reconciliation behavior

After guild profile and roster persistence, current roster Characters are selected for presentation acquisition when:

- newly observed or returning after absence;
- roster-observed presentation coordinates changed;
- profile data is missing and not in a known-unavailable cooldown;
- media data is missing and not in a known-unavailable cooldown.

An unchanged current Character with complete profile and media data causes no Character API work.

Characters absent from the latest roster are marked `currently_present = false`; historical observations are preserved.

Follow-up presentation acquisition is documented in [`character-presentation-acquisition.md`](character-presentation-acquisition.md).

## Presentation availability

Roster membership and Character presentation availability are independent observations.

HTTP 404 from Character profile/media does not negate roster membership. Profile and media attempts record failure independently. A 404 suppresses another request for that same missing resource for seven days.

Newly observed, returning, or presentation-changed Characters bypass that cooldown. Successful acquisition clears the corresponding failure status. Other failures remain retryable normally.

## Blizzard request boundary

All Blizzard authority GET requests use the shared request gate, currently limited to 10 requests per second.

The boundary retries HTTP 429 and 5xx responses, honors `Retry-After`, and otherwise uses exponential backoff.

Manual, automatic, authentication, guild, and Character-presentation callers cannot bypass the shared GET gate. OAuth token exchange and application-token acquisition remain outside that gate.

## Operational inspection

Completed refreshes publish `guild / refresh` evidence to [`operational-inspection.md`](operational-inspection.md) as `success` or `partial`. A refresh that does not complete publishes an exception when possible before rethrowing the original failure.

Manual refreshes record the initiating Guildie actor. Scheduled and CLI refreshes do not have a human actor.

Inspection publication is best effort and never rolls back authoritative roster reconciliation.
