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

## Managed projections

Guild Operations manages exactly two role families.

### Linked Guildie role

The Linked role is authored by Guild Operations from the existing Guildie↔Discord association.

Desired state is:

```text
association exists
AND associated Discord user is currently in the server
→ Linked role present

association absent
OR Discord user absent from the server
→ Linked role absent
```

Possessing the role never creates or proves the association. The role is a projection marker only.

The Linked role should be corrected as promptly as practical. Association and disassociation trigger reconciliation, and broader reconciliation may serve as a backstop.

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
- desired state may be calculated;
- no role add/remove request is sent to Discord.

When enabled, reconciliation may mutate only the configured Linked and rank roles. Unrelated human-managed Discord roles are untouched.

Saving configuration while projection is enabled performs a full reconciliation so mapping changes do not wait for another unrelated trigger.

## Reconciliation triggers

Current triggers are:

- Discord association establishment;
- Discord disassociation;
- Guildie join/leave/rank transitions discovered by guild refresh;
- enabling or saving projection configuration while enabled.

The integration intentionally does not run a Discord Gateway listener yet. If real use demonstrates that Discord-originated drift must be corrected faster than REST/backstop reconciliation can provide, that pressure may earn a Gateway seam later.

## Operational inspection

Enabled reconciliation publishes administrator-useful evidence through global operational inspection.

Current producer coordinates are:

```text
source: discord
operation: roles.reconcile
```

Successful records include the Guildie/Discord coordinates, trigger, desired role IDs, and role IDs actually added or removed. Failed mutations publish an operational exception with planned and completed role work plus a safe error message.

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

That page shows what Discord currently says, what Guild Operations currently wants for the Linked role, whether those states differ, the projected action, and when Discord was observed. It performs no mutation.

Completed reconciliation outcomes are inspected through the global operational record surface:

```text
/admin/operations
```

## Boundary

This machinery is conceptually a subset of Guildie machinery but mechanically keeps a distinct Discord integration boundary. That preserves provenance and freshness without inventing a separate Discord member model or flattening Discord-owned observations into Guildie truth.
