# Event Publishing

Guild Operations publishes meaningful operational occurrences after authoritative state has been established.

Events create attention, not truth. They identify what changed and provide the smallest coordinates needed for a subscriber to query Guild Operations for current authoritative state.

Concrete references are separated by purpose:

- `docs/publications/events.md` — what operational events are published and which coordinates they carry.
- `docs/endpoints/events.md` — the authoritative HTTP query contract subscribers use afterward.
- `docs/integrations/botghost.md` — practical BotGhost variables and follow-up requests for the current transport.

```text
authoritative change
       ↓
publish occurrence + coordinates
       ↓
subscriber notices
       ↓
subscriber queries Guild Operations
       ↓
subscriber observes current truth
       ↓
subscriber converges its local projection
```

## Event scopes

### Subject

Subject events concern durable Guild Operations subject state and Guild Operations-owned associations or preferences.

A subject event is not a report of every Blizzard-observed account or character change. Controlled characters outside the guild remain valid subject observations, but they are not member events merely because they changed.

### Member

Member events concern the derived relationship between a subject and the guild. Current membership is established by the intersection of subject-controlled characters and the current Blizzard guild roster.

Member events should be published only at reconciliation boundaries where before/after member truth can be compared. Individual character or roster-row mutations are inputs, not automatically member events.

### Guild

Guild events concern meaningful changes to the guild object or its authoritative observed state. A guild refresh running is not itself an event; a meaningful resulting change may be.

## Publication rules

- Publish only after the authoritative operation succeeds.
- Publish only when meaningful truth actually changed. A repeated ceremony or no-op does not qualify.
- Events carry semantic occurrence plus small authority-oriented coordinates, not flattened state snapshots.
- Subscribers query Guild Operations afterward to establish what is true now.
- Publication failure does not undo a successful authoritative operation.
- BotGhost is the first transport and subscriber surface, not the owner or semantic target of the event model.
- Do not introduce a generic event bus until multiple concrete features demonstrate the need.

## Coordinates that disappear

An event may include an affected coordinate that no longer appears in current state when a subscriber needs it to reconcile a projection.

`subject.discord.unlinked`, for example, carries the removed Discord user ID. Querying the subject after unlink correctly returns no Discord association, but the subscriber still needs the old Discord coordinate to remove any stale Discord-side projection.
