# Publication Model

Guild Operations publishes meaningful operational occurrences after authoritative state has been established.

A publication creates attention, not truth. It identifies what changed and provides the smallest coordinates needed for a subscriber to query Guild Operations for current authoritative state.

This terminology deliberately avoids using **Events** as the name of the publication mechanism. In Guild Operations, a **Guild Event** is a concrete occurrence that an appropriate participation module may establish through the shared Guild Event Listing contract. Modules own their participation capabilities and procedures; Guild Events are discoverable occurrences of those capabilities, not containers for the modules themselves.

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

## Recognition and membership vocabulary

### Guildie

A **Guildie** is Guild Operations' durable representation of the real-world guild organizational member. The durable coordinate is `guildie_id`.

Guildie continuity is non-destructive. A Guildie does not cease to exist merely because none of their controlled Characters are currently on the guild roster.

Current Guildie organizational membership is derived from controlled Characters intersecting the current Character roster:

```text
controlled Characters
        ∩
current Blizzard Character roster
        ↓
current Guildie organizational membership
```

A Guildie with at least one controlled Character on the current roster has a current participation surface. A Guildie with no controlled Characters on the current roster remains known but has no current guild participation surface or rank-derived authority.

Effective Guildie rank is the highest-authority Blizzard rank among the Guildie's currently controlled roster Characters. Under the current Blizzard ordering, the lower numeric rank index has higher authority.

### Character

A **Character** is a durable WoW character object and the member object of Blizzard's guild organization. For guild participation, a Character is either currently present on the Blizzard guild roster with a Blizzard-owned numeric rank, or it is not.

The current Character roster is dictated by the actual in-game guild environment. Guild Operations observes and reconciles that roster; it does not manufacture Character membership.

### Subject

**Subject is not a publication object or coordinate.** It is contextual language designating whichever existing object a statement or relation is about.

Publications therefore carry the actual object coordinates relevant to the occurrence: `guildie_id`, Character coordinates, `round_id`, `claim_id`, `guild_event_id`, or other concrete coordinates earned by the domain. They do not introduce a generic Subject coordinate.

## Publication scopes

### Character publications

Character publications concern meaningful changes to a Character's current Blizzard-observed guild-roster state:

- `character.joined`
- `character.left`
- `character.rank.changed`

A Character may be on the guild roster without any known Guildie controlling it.

### Guildie publications

Guildie publications concern meaningful Guild Operations state belonging to the real-world guild member, including current organizational participation state and Guild Operations-owned associations or preferences:

- `guildie.joined`
- `guildie.left`
- `guildie.rank.changed`
- `guildie.discord.linked`
- `guildie.discord.unlinked`
- `guildie.main.changed`

`guildie.joined` and `guildie.left` are not object-creation or closeout states. They mean that the Guildie respectively acquired or lost a current participation surface because the controlled-Character intersection with the Character roster crossed between zero and at least one.

Guildie state can change when either side of that intersection changes. Blizzard roster reconciliation can change Character state, while Blizzard account reconciliation can change which Characters are currently controlled by the Guildie.

### Guild

Guild publications concern meaningful changes to the guild object or its authoritative observed state. A guild refresh running is not itself a publication; a meaningful resulting change may be.

## Publication rules

- Publish only after the authoritative operation succeeds.
- Publish only when meaningful truth actually changed. A repeated ceremony or no-op does not qualify.
- Publications carry semantic occurrence plus small authority-oriented coordinates, not flattened state snapshots.
- Publications name actual domain objects and relationships; they do not create a generic Subject abstraction.
- Subscribers query Guild Operations afterward to establish what is true now.
- Publication failure does not undo a successful authoritative operation.
- BotGhost is the first transport and subscriber surface, not the owner or semantic target of the publication model.
- Do not introduce a generic event bus or publication framework until multiple concrete features demonstrate the need.

## Coordinates that disappear

A publication may include an affected coordinate that no longer appears in current state when a subscriber needs it to reconcile a projection.

`guildie.discord.unlinked`, for example, carries the removed Discord user ID. Querying the Guildie after unlink correctly returns no Discord association, but the subscriber still needs the old Discord coordinate to remove any stale Discord-side projection.
