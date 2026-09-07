# Guildie Discord State

Guildie Discord state is Guildie-oriented infrastructure for directly observing Discord-owned server state and projecting a small set of Guild Operations-managed roles back into Discord.

It is not a parallel identity system and it does not make Discord authoritative for guild membership, rank, or Guild Operations authorization.

## Authority order

The governing direction is:

```text
WoW / Blizzard
    ↓
Guildie / Guild Operations
    ↓
Discord association
    ↓
Discord guild-member observation
    ↓
Discord projections and participation convenience
```

Blizzard owns current WoW guild membership and numeric rank. Guild Operations owns Guildie continuity, the Discord association, capability meaning, and managed projection policy. Discord owns the observable fact of whether the associated Discord user is currently in the configured server and which Discord roles that server member currently has.

A direct Discord observation is high-trust evidence of Discord state at observation time. It is not promoted into Guild Operations-owned guild truth.

## Configuration

Direct server observation and role mutation use:

```text
DISCORD_GUILD_ID
DISCORD_BOT_TOKEN
```

These values are optional at application startup. When either is absent, direct Discord guild integration is unavailable.

The existing Discord OAuth association continues to use its own application credentials and ceremony. Direct guild observation does not replace or redefine association.

The bot should have only the permissions needed for the managed operations. Role mutation requires `MANAGE_ROLES`, and Discord role hierarchy requires the bot's highest role to be above every Guild Operations-managed role. Administrator permission is unnecessary.

## Guildie observation

`discordStateForGuildie(guildie_id)` starts from an existing Guildie and its established Discord association. It then asks Discord for that known user inside the configured guild server.

The observed state is:

```text
guildieId
associated
discordUserId
presentInGuild
roleIds
observedAt
```

`observedAt` is Unix time. The observation is not persisted as independent Guild Operations truth.

The initial integration uses direct Discord REST acquisition for known associated users. It does not list the whole server membership and does not use a Gateway connection.

Guild Operations-owned membership state is evaluated before Discord projection can become desired state. A Guildie who is no longer a current Blizzard-backed guild member has no desired managed Discord roles; any managed roles still observed for that association are removal candidates.

## Managed projections

Guild Operations manages exactly two role families.

### Linked Guildie role

The Linked role is authored by Guild Operations from current guild membership plus the existing Guildie↔Discord association.

Desired state is:

```text
current guild membership
AND association exists
AND associated Discord user is currently in the server
→ Linked role present

otherwise
→ Linked role absent
```

Possessing the role never creates or proves the association. The role is a projection marker only.

The Linked role should be corrected as promptly as practical. Association and disassociation trigger reconciliation, and guild refresh provides the broader reconciliation cadence.

### Rank roles

Rank roles are projections of Blizzard-owned current rank through Guild Operations-owned rank meaning.

```text
Blizzard current rank
    ↓
Guild Operations effective rank
    ↓
guild-owned rank→Discord-role mapping
    ↓
Discord role projection
```

Lower numeric Blizzard rank indexes represent higher authority. A Guildie receives the configured role for their effective rank and every configured lower-authority role below it. This lets Discord-side automation use a lower threshold role as a cheap eligibility preflight without excluding higher ranks.

Rank-role projection is eventually consistent. Discord role possession never grants Guild Operations capability by itself.

## Refusal and approval

Managed Discord roles are useful preflight language for Discord-side automation, including BotGhost.

The safe asymmetry is:

> Projected state may deny early. Projected state may not approve.

A missing role may produce a false refusal if projection is stale; that inconvenience is acceptable. A present role may only justify asking Guild Operations to perform the authoritative capability check. Backend authorization remains decisive.

## Evaluation and mutation procedure

Evaluation and mutation are separate concerns.

A meaningful trigger first commits the Guild Operations- or Blizzard-backed truth that caused the trigger. Discord is then read for the state it owns, and the managed-role evaluator calculates the difference between current and desired projection state.

The procedure is:

```text
authoritative change commits
    ↓
confirm current guild membership context
    ↓
resolve existing Discord association
    ↓
read current Discord-authoritative state when associated
    ↓
calculate planned additions/removals
    ↓
projection disabled → stop with plan only
projection enabled  → execute the calculated mutations
```

The evaluation result keeps planned work explicit even when projection is disabled:

```text
desiredRoleIds
currentManagedRoleIds
plannedAddRoleIds
plannedRemoveRoleIds
observedAt
```

Mutation results are separate:

```text
addedRoleIds
removedRoleIds
```

The projection enablement setting gates only mutation. It does not gate observation or evaluation.

## Bulk convergence

Large role changes use the same evaluator and the same individual Discord role add/remove operations as single-Guildie reconciliation. Guild Operations does not replace the member's entire Discord role set because it owns only the configured managed roles.

Bulk reconciliation first evaluates the candidate Guildies, discards no-op evaluations, and then executes only the planned role mutations. Discord reads and mutations use a bounded worker pool with a concurrency ceiling of five. This prevents a first rollout or large rank remap from becoming an unbounded `Promise.all` burst.

The Discord request boundary recognizes HTTP 429 rate limiting, waits for Discord's supplied retry interval, and retries a bounded number of times. Other provider failures remain explicit failures.

Bulk execution keeps additions before removals within each Guildie's mutation sequence. That minimizes the temporary false-refusal window during mapping transitions while preserving the rule that Discord roles cannot authorize Guild Operations actions.

## Projection gate

Role mutation is controlled by persisted guild-level settings in:

```text
guild_discord_projection_settings
guild_discord_rank_roles
```

Projection defaults to disabled.

When disabled:

- direct observation may still run;
- role mappings may be configured;
- desired state is calculated when a reconciliation trigger runs;
- pending additions/removals remain inspectable;
- no role add/remove request is sent to Discord.

When enabled, reconciliation may mutate only the configured Linked and rank roles. Unrelated human-managed Discord roles are untouched.

Saving projection configuration always evaluates all associated Guildies after the configuration commit. If projection is disabled, evaluation stops before mutation. If projection is enabled, the same evaluation may proceed through bounded bulk mutation.

## Reconciliation triggers

Discord owns no independent scheduler. Its cadence comes from existing Guildie and guild-refresh machinery.

Current triggers are:

- Discord association establishment;
- Discord disassociation;
- guild refresh, including immediate Guildie join/leave/rank transitions and a broader associated-Guildie convergence pass;
- every saved projection configuration change, including while projection remains disabled;
- enabling projection.

Guild refresh is therefore the recurring heartbeat for Discord projection. Authority changes discovered by refresh require reconciliation, while the broader pass also catches Discord-side drift without introducing a second polling schedule.

The integration intentionally does not run a Discord Gateway listener. If real use demonstrates that Discord-originated drift must be corrected faster than the guild-refresh cadence can provide, that pressure may earn a Gateway seam later.

## Operational inspection

Enabled single-Guildie reconciliation publishes administrator-useful evidence through global operational inspection under:

```text
source: discord
operation: roles.reconcile
```

Large reconciliation runs publish one run-level result under:

```text
source: discord
operation: roles.reconcile.bulk
```

The bulk result records the trigger, Guildies considered/evaluated/associated/current, no-op and changed counts, planned additions/removals, completed additions/removals, and safe per-Guildie failure coordinates when a run is partial or failed. Successful no-op bulk passes are not written merely to prove that nothing changed.

Disabled evaluations do not create operational-history noise merely for calculating a plan. Pending actions are the inspection surface for that state.

Inspection publication remains best effort and never becomes authority over the association, rank, or Discord mutation itself.

Runtime diagnostics remain in runtime logging. Secrets, bot tokens, OAuth material, request headers, and raw Discord payloads must never be placed in operational record details.

## Administrative surfaces

Discord configuration is globally owned and appears directly on:

```text
/admin
```

It does not receive a redundant `/admin/discord` configuration namespace.

Read-only reconciliation preview is intentionally a distinct inspection surface:

```text
/admin/discord-state
```

Its user-facing name is **Pending actions**. The route remains stable while the presentation describes what the surface actually answers.

Pending actions uses the same evaluator as reconciliation. It shows current managed roles, desired managed roles, planned additions/removals, Discord server presence, and observation time. It performs no mutation.

Completed reconciliation outcomes are inspected through the global operational record surface:

```text
/admin/operations
```

## Boundary

This machinery is conceptually a subset of Guildie machinery but mechanically keeps a distinct Discord integration boundary. That preserves provenance and freshness without inventing a separate Discord member model or flattening Discord-owned observations into Guildie truth.
