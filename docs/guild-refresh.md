# Guild refresh

Guild refresh is the authoritative reconciliation procedure for Blizzard-owned guild state.

It is not a full-roster enrichment sweep. A refresh first acquires the current Blizzard guild profile and roster, persists that observation, and then determines what Character presentation work is actually required.

## Responsibility boundary

Guild refresh owns this question:

> Which Characters are currently members of OH CRIT I Pulled!, and what Blizzard-owned numeric guild rank does each currently hold?

It does not establish which Characters a Guildie controls. That comes from Blizzard account authority through Guildie account/control reconciliation.

It also does not make Character presentation authoritative for membership. Profile/media acquisition enriches an already identified Character but cannot add a Character to the guild roster or make it eligible for Guild Operations.

Current Guildie-facing Character eligibility remains the intersection:

```text
Guildie's currently controlled Characters
                ∩
current Blizzard guild Character roster
                ↓
eligible Guild Operations Characters
```

Guild refresh may change the roster side of that intersection. Self account refresh may change the control side. Neither side can substitute for the other.

## Trigger model

The same authoritative refresh procedure is used regardless of invocation surface.

Current invocation surfaces are:

- `npm run guild:sync`, a one-shot operator/debug CLI;
- the protected manual `POST /guild/refresh` endpoint requiring the `guild.refresh` capability;
- the application-owned automatic guild refresh scheduler.

The automatic scheduler is internal Guild Operations machinery. It is not configured through environment variables and is not implemented as a Docker Compose worker.

The concrete persisted schedule belongs to guild refresh and records:

- whether automatic refresh is enabled;
- the refresh interval in seconds;
- the next due Unix instant.

The interval must be an integer of at least 300 seconds.

Manual refresh and automatic refresh are deliberately independent triggers. A manual refresh does not move the automatic cadence.

Scheduling semantics are:

- enabling automatic refresh schedules the first automatic run one configured interval from the time the setting is saved;
- changing the interval restarts the automatic cadence from the time the setting is saved;
- disabling automatic refresh clears the next due instant;
- re-enabling starts a fresh cadence;
- after an automatic occurrence is claimed, the next due instant advances by the configured interval from that claim time;
- a failed refresh does not disable automatic scheduling or stop later occurrences.

The scheduler checks persisted due state inside the running application. Claiming a due occurrence is an atomic database update so two application processes cannot claim the same persisted occurrence casually. Within one application process, an automatic refresh is not overlapped with another scheduler-triggered refresh.

Manual web execution and schedule configuration both require the `guild.refresh` capability. `guild.refresh` is granted to Blizzard guild rank indexes 0, 1, and 2.

Blizzard rank authority is inverse to the numeric index for this guild: rank 0 is the highest authority. Authorization consumers do not encode that ordering themselves; they ask for the capability.

## Administrative presentation

The global `/admin` surface presents guild refresh inside the `Guild settings` section.

The current refresh status exposes two separate pieces of truth:

- current member count from persisted current roster membership;
- `Last reconciled`, derived from the most recent successful persistence of Blizzard guild authority.

Automatic refresh presentation exposes the persisted enabled state, interval in seconds, and next due instant. Browser presentation converts Unix instants to the viewer's local time.

`Refresh now` invokes the existing protected manual refresh endpoint. It does not duplicate guild reconciliation logic.

## Operational inspection

Guild refresh publishes operational evidence through the global operational inspection capability.

Completed refreshes publish a `guild / refresh` result with `success` or `partial` classification and structured reconciliation details. A refresh that does not complete publishes an exception before the original failure is rethrown when possible.

Manual refreshes include the initiating Guildie's id as actor. Automatic and CLI refreshes have no human actor.

Operational publication is best effort relative to authoritative guild reconciliation. Failure to publish inspection evidence does not roll back or reinterpret guild truth.

## Reconciliation

After the guild profile and roster are persisted, current roster Characters are checked for targeted follow-up acquisition.

Character profile/media acquisition is requested when:

- a current roster Character is newly observed or returns after being absent;
- presentation coordinates observed in the roster change;
- a current roster Character is missing persisted profile data and is not in a known-unavailable cooldown;
- a current roster Character is missing persisted media data and is not in a known-unavailable cooldown.

An unchanged current Character with complete profile and media data causes no Character API work.

Characters absent from the latest roster are marked `currently_present = false`. Historical observations are not deleted.

The follow-up presentation capability is defined in [`character-presentation-acquisition.md`](character-presentation-acquisition.md). Guild refresh selects the roster-derived targets; presentation acquisition does not decide why those Characters are relevant.

The one-shot CLI reports the observed roster count plus Character presentation reconciliation counts and failures to runtime output. Scheduled execution uses the same application operation boundary and publishes the same operational result shape used by manual execution.

## Presentation availability

Roster membership and Character presentation availability are separate Blizzard observations.

A Character may be authoritatively present in the guild roster while Blizzard's Character profile or media endpoint returns HTTP 404. A 404 therefore does not negate roster membership and does not cause the Character to be deleted or treated as nonexistent.

Profile and media acquisition attempts record their last attempt and HTTP failure status independently. A 404 marks that presentation resource as currently unavailable. Ordinary guild refreshes suppress another request for that same missing resource for seven days.

The suppression is not permanent. The resource becomes eligible for another acquisition after the cooldown. A newly observed, returning, or presentation-changed roster Character bypasses the cooldown immediately because the changed Blizzard observation is reason to reconsider availability.

Successful acquisition clears the corresponding failure status.

Other failures are recorded but are not given the 404 cooldown; subsequent reconciliation may retry them normally.

## Blizzard request boundary

All Blizzard authority GET requests share one request gate. The gate currently limits requests to 10 per second and is applied inside the Blizzard acquisition boundary, not by individual triggers.

The same boundary retries HTTP 429 and 5xx responses, honors `Retry-After` when supplied, and otherwise applies exponential backoff.

A manual trigger, automatic trigger, authentication acquisition, guild acquisition, or Character presentation acquisition cannot opt out of the shared request gate.

OAuth token exchange/client-credential token acquisition are authentication operations and remain outside the Blizzard authority GET request gate.

## Separation of concerns

Authorization answers whether a caller may request a refresh or change its automatic schedule.

The Blizzard request boundary answers when an external request may actually be made.

Guild refresh answers what current guild-roster truth changed and which follow-up Character presentation acquisitions are required.

Guildie account/control reconciliation answers which Characters a Guildie currently controls.

Character presentation acquisition answers what richer Blizzard profile/media state can currently be observed for a Character that another authority procedure has already identified as relevant.

Scheduling answers when the guild refresh procedure should be invoked. It does not own guild reconciliation semantics.

These responsibilities remain separate even when one procedure triggers follow-up work in another.
