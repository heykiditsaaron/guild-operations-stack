# Guild Reconciliation Publications

Guild reconciliation compares Blizzard's newly acquired guild roster with the authoritative roster state Guild Operations already holds, persists the new observation, and publishes only meaningful changes established by that reconciliation.

See `docs/publication-model.md` for the cross-cutting publication rules.

## Membership vocabulary

`member` is intentionally not used on its own here because it does not identify which relationship changed.

- **character-membership** is the Blizzard-observed relationship between a WoW character and the guild.
- **subject-membership** is Guild Operations' derived relationship between a subject and the guild. It exists while at least one character currently controlled by that subject is currently a character-member of the guild.

These are relationships over the existing persistence objects. They do not introduce new persisted member objects.

## Character-membership publications

### `character-member.joined`

Published when reconciliation establishes that a character is currently on the Blizzard guild roster and was not currently present in the previous authoritative roster state.

Coordinates:

- `guildId`
- `region`
- `realmId`
- `characterId`

### `character-member.left`

Published when a character that was previously currently present is absent from the newly acquired Blizzard guild roster.

Coordinates:

- `guildId`
- `region`
- `realmId`
- `characterId`

The character remains a durable WoW object where Guild Operations already knows it. Historical participation is not rewritten. The character simply ceases to be currently eligible where guild participation requires current character-membership.

### `character-member.rank.changed`

Published when Blizzard reports a different numeric guild rank for a currently present character.

Coordinates:

- `guildId`
- `region`
- `realmId`
- `characterId`

Blizzard owns the numeric rank fact. Guild Operations owns what that rank means outside WoW.

## Subject-membership publications

Subject-membership is derived from the intersection of currently controlled characters and the current Blizzard guild roster.

### `subject-member.joined`

Published when a subject moves from controlling zero current character-members to controlling at least one.

Coordinates:

- `subjectId`
- `guildId`

### `subject-member.left`

Published when a subject moves from controlling at least one current character-member to controlling zero.

Coordinates:

- `subjectId`
- `guildId`

A single character leaving does not produce this publication when another currently controlled character remains in the guild.

### `subject-member.rank.changed`

Published when the subject's effective current guild rank changes.

Coordinates:

- `subjectId`
- `guildId`

Effective rank is the highest-authority rank among all of the subject's currently controlled character-members. Under the current Blizzard rank ordering, the lower numeric `rank_index` has higher authority.

A character rank change therefore does not necessarily produce a subject rank change.

## Reconciliation boundary

Publications are calculated from before and after authoritative state inside reconciliation, but are transported only after the persistence transaction succeeds.

Publication transport failure does not reverse the successfully established guild state.

A refresh that establishes no character-membership or subject-membership transition publishes nothing. Presentation-coordinate changes remain recognition enrichment concerns rather than membership publications.

Character presentation enrichment remains downstream recognition enrichment and is not itself guild-membership truth.
