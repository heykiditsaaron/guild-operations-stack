# Guild refresh

> **Investigation note: consolidation with Character enrichment is deferred.**
>
> The known self account refresh bug should be investigated before this document becomes the sole home for the older `guild-character-enrichment.md` doctrine. Guild refresh currently owns targeted Character profile/media acquisition after guild-roster reconciliation, while self account refresh reacquires a Guildie's Blizzard account/control observation through a different authority ceremony.
>
> The brittle point is responsibility for follow-up observations: when self refresh changes which Characters a Guildie currently controls, there is no obvious explicit step in that ceremony that asks whether those Characters now require profile/media acquisition. Investigate whether the existing targeted Character acquisition machinery can be invoked independently of guild-roster refresh, or whether a smaller shared reconciliation seam is warranted by the two real callers. Do not collapse guild-roster authority, Guildie account-control authority, and Character presentation acquisition into one refresh concept merely to share implementation.
>
> Also inspect the self-refresh reuse of the Guildie establishment persistence boundary. `establishOrResolveGuildie()` currently reconciles controlled Characters and has broader establishment-related effects; determine during the bug fix whether an existing-Guildie refresh should deliberately reuse that entire boundary or should have a narrower account-observation reconciliation procedure. This note records an investigation target, not a predetermined replacement architecture.

Guild refresh is the authoritative reconciliation procedure for Blizzard-owned guild state.

It is not a full-roster enrichment sweep. A refresh first acquires the current Blizzard guild profile and roster, persists that observation, and then determines what character presentation work is actually required.

## Trigger model

The same `refreshGuildAuthority()` procedure is used regardless of trigger.

- Scheduled or other system-owned execution may invoke it directly.
- Manual web execution requires the `guild.refresh` capability.
- `guild.refresh` is granted to Blizzard guild rank indexes 0, 1, and 2.

Blizzard rank authority is inverse to the numeric index for this guild: rank 0 is the highest authority. Authorization consumers do not encode that ordering themselves; they ask for the capability.

## Reconciliation

After the guild profile and roster are persisted, current roster characters are checked for targeted follow-up acquisition.

Character profile/media acquisition is requested when:

- a current roster character is newly observed or returns after being absent;
- presentation coordinates observed in the roster change;
- a current roster character is missing persisted profile data and is not in a known-unavailable cooldown;
- a current roster character is missing persisted media data and is not in a known-unavailable cooldown.

An unchanged current character with complete profile and media data causes no character API work.

Characters absent from the latest roster are marked `currently_present = false`. Historical observations are not deleted.

## Presentation availability

Roster membership and character presentation availability are separate Blizzard observations.

A character may be authoritatively present in the guild roster while Blizzard's character profile or media endpoint returns HTTP 404. A 404 therefore does not negate roster membership and does not cause the character to be deleted or treated as nonexistent.

Profile and media acquisition attempts record their last attempt and HTTP failure status independently. A 404 marks that presentation resource as currently unavailable. Ordinary guild refreshes suppress another request for that same missing resource for seven days.

The suppression is not permanent. The resource becomes eligible for another acquisition after the cooldown. A newly observed, returning, or presentation-changed roster character bypasses the cooldown immediately because the changed Blizzard observation is reason to reconsider availability.

Successful acquisition clears the corresponding failure status.

Other failures are recorded but are not given the 404 cooldown; subsequent reconciliation may retry them normally.

## Blizzard request boundary

All Blizzard authority GET requests share one request gate. The gate currently limits requests to 10 per second and is applied inside the Blizzard acquisition boundary, not by individual triggers.

The same boundary retries HTTP 429 and 5xx responses, honors `Retry-After` when supplied, and otherwise applies exponential backoff.

A manual trigger, scheduled trigger, authentication acquisition, guild acquisition, or character enrichment cannot opt out of the shared request gate.

OAuth token exchange/client-credential token acquisition are authentication operations and remain outside the Blizzard authority GET request gate.

## Separation of concerns

Authorization answers whether a caller may request a refresh.

The Blizzard request boundary answers when an external request may actually be made.

Guild refresh answers what current guild truth changed and which follow-up acquisitions are required.

These responsibilities remain separate even when they execute as one procedure.
