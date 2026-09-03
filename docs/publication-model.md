# Publication Model

Guild Operations publishes meaningful operational occurrences after authoritative state has been established.

A publication creates attention, not truth. It identifies what changed and provides the smallest coordinates needed for a subscriber to query Guild Operations for current authoritative state.

This terminology deliberately avoids using **Events** as the name of the publication mechanism. In Guild Operations, **Events** is reserved for the participatory, calendar-style activities the guild runs.

Concrete references are separated by purpose:

- `docs/publications/` — what each module or machinery publishes and which coordinates those publications carry.
- `docs/endpoints/` — authoritative HTTP contracts, including query surfaces subscribers can use afterward.
- `docs/integrations/` — practical references for concrete external surfaces such as BotGhost.

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

## Publication scopes

### Subject

Subject publications concern durable Guild Operations subject state and Guild Operations-owned associations or preferences.

A subject publication is not a report of every Blizzard-observed account or character change. Controlled characters outside the guild remain valid subject observations, but they are not membership publications merely because they changed.

### Character-membership

Character-membership publications concern the Blizzard-observed relationship between a WoW character and the guild.

A **character-member** is a character currently observed on the guild roster. Character-membership may exist without any known Guild Operations subject controlling that character.

Roster observations are inputs to reconciliation. Publications are emitted only when reconciliation establishes a meaningful before/after character-membership transition such as join, leave, or rank change.

### Subject-membership

Subject-membership publications concern Guild Operations' derived relationship between a subject and the guild. Current subject-membership exists while at least one character currently controlled by the subject is currently a character-member.

A **subject-member** is therefore not a separately persisted member object. Subject-membership is derived from controlled characters intersected with current character-membership.

Subject-membership can change when either side of that intersection changes: Blizzard guild-roster reconciliation can change character-membership, and subject character-control reconciliation can change which character-members are currently controlled. Publications should be emitted only where before/after subject-membership truth can be compared.

### Guild

Guild publications concern meaningful changes to the guild object or its authoritative observed state. A guild refresh running is not itself a publication; a meaningful resulting change may be.

## Publication rules

- Publish only after the authoritative operation succeeds.
- Publish only when meaningful truth actually changed. A repeated ceremony or no-op does not qualify.
- Publications carry semantic occurrence plus small authority-oriented coordinates, not flattened state snapshots.
- Subscribers query Guild Operations afterward to establish what is true now.
- Publication failure does not undo a successful authoritative operation.
- BotGhost is the first transport and subscriber surface, not the owner or semantic target of the publication model.
- Do not introduce a generic event bus or publication framework until multiple concrete features demonstrate the need.

## Coordinates that disappear

A publication may include an affected coordinate that no longer appears in current state when a subscriber needs it to reconcile a projection.

`subject.discord.unlinked`, for example, carries the removed Discord user ID. Querying the subject after unlink correctly returns no Discord association, but the subscriber still needs the old Discord coordinate to remove any stale Discord-side projection.
