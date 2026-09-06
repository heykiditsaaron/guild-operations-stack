# Guild refresh

> **Investigation note: implementation consolidation remains pending.**
>
> The refresh responsibilities are now settled: Guildie account/control reconciliation, guild-roster reconciliation, and Character presentation acquisition are distinct concerns. Guild refresh owns guild-roster reconciliation and may request follow-up Character presentation acquisition for Characters whose current roster observation requires it. Self account refresh owns Guildie account/control reconciliation and may independently request Character presentation acquisition for Characters that are already eligible for Guild Operations.
>
> The remaining implementation question is how to expose Character presentation acquisition as a reusable capability without making it responsible for either account-control authority or guild-roster authority. Also inspect whether existing-Guildie account reconciliation should continue to reuse the broader Guildie establishment persistence boundary. Those are implementation questions, not unresolved authority questions.

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

The same `refreshGuildAuthority()` procedure is used regardless of trigger.

- Scheduled or other system-owned execution may invoke it directly.
- Manual web execution requires the `guild.refresh` capability.
- `guild.refresh` is granted to Blizzard guild rank indexes 0, 1, and 2.

Blizzard rank authority is inverse to the numeric index for this guild: rank 0 is the highest authority. Authorization consumers do not encode that ordering themselves; they ask for the capability.

## Reconciliation

After the guild profile and roster are persisted, current roster Characters are checked for targeted follow-up acquisition.

Character profile/media acquisition is requested when:

- a current roster Character is newly observed or returns after being absent;
- presentation coordinates observed in the roster change;
- a current roster Character is missing persisted profile data and is not in a known-unavailable cooldown;
- a current roster Character is missing persisted media data and is not in a known-unavailable cooldown.

An unchanged current Character with complete profile and media data causes no Character API work.

Characters absent from the latest roster are marked `currently_present = false`. Historical observations are not deleted.

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

A manual trigger, scheduled trigger, authentication acquisition, guild acquisition, or Character presentation acquisition cannot opt out of the shared request gate.

OAuth token exchange/client-credential token acquisition are authentication operations and remain outside the Blizzard authority GET request gate.

## Separation of concerns

Authorization answers whether a caller may request a refresh.

The Blizzard request boundary answers when an external request may actually be made.

Guild refresh answers what current guild-roster truth changed and which follow-up Character presentation acquisitions are required.

Guildie account/control reconciliation answers which Characters a Guildie currently controls.

Character presentation acquisition answers what richer Blizzard profile/media state can currently be observed for a Character that another authority procedure has already identified as relevant.

These responsibilities remain separate even when one procedure triggers follow-up work in another.
