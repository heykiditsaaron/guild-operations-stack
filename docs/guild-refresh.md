# Guild refresh

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
- a current roster character is missing persisted profile data;
- a current roster character is missing persisted media data.

An unchanged current character with complete profile and media data causes no character API work.

Characters absent from the latest roster are marked `currently_present = false`. Historical observations are not deleted.

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
