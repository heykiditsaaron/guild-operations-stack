# Discord module state and projection

Discord is a packaged, optional first-party Guild Operations module. It owns Discord association, Discord-owned server observations, managed-role projection, Discord-specific configuration, and its administrative surfaces.

Discord is not part of the canonical Guildie object and is not authoritative for World of Warcraft guild membership, rank, or Guild Operations authorization.

## Authority order

```text
WoW / Blizzard
    ↓
Guild / Guildie / Guild Operations authority
    ↓
Discord module-owned association
    ↓
Discord server observation
    ↓
Discord projections and participation convenience
```

Blizzard owns current WoW guild membership and numeric rank. Guild Operations core owns Guildie continuity and capability meaning. The Discord module owns its association and projection policy. Discord itself owns the observable fact of whether an associated Discord user is currently in the configured server and which roles that server member currently has.

A direct Discord observation is evidence of Discord state at observation time. It is never promoted into core guild truth.

## Module configuration

A fresh Guild Operations deployment requires no Discord-specific environment variables. Discord configuration is established administratively at:

```text
/admin/discord
```

The module owns:

```text
module enabled / disabled
Discord application ID
Discord application secret
Discord server ID
bot token
Discord invite URL
Linked Role configuration and enablement
Rank Mapping configuration and enablement
```

The application secret and bot token are write-only administrative secrets. The browser can see whether each secret is configured and may replace or remove it, but the stored plaintext is never returned to the browser.

Persisted Discord secrets are encrypted at rest using the installation-level `APPLICATION_ENCRYPTION_KEY`. That value is application infrastructure rather than Discord configuration. The application may run without it, but Discord secrets cannot be stored or used until an encryption root is configured.

The Discord OAuth callback remains derived from global `APP_ORIGIN` because application origin is a property of the installation rather than the Discord module.

Disabling the module does not delete its configuration, associations, or role-map settings. It prevents active Discord behavior and hides Discord-provided participation presentation until the module is enabled again.

## Module enablement and Role Maps

Discord module enablement and Discord role-map enablement are intentionally distinct.

```text
Discord module enabled
    → Discord association, observation, presentation, and integration behavior may operate

Linked Role enabled
    → the configured Linked Role participates in desired-role evaluation and reconciliation

Rank Mapping enabled
    → configured guild-rank → Discord-role mappings participate in desired-role evaluation and reconciliation
```

There is no master Role Maps activation switch. The Role Maps page is the administrative home for the concrete mappings the module currently owns. Linked Role and Rank Mapping each preserve their configured role IDs while disabled and independently decide whether they participate in reconciliation.

A guild may therefore use Discord association and observation while leaving either or both managed-role behaviors disabled.

## Guildie association

The module may associate an existing Guildie with one Discord user ID. The association does not establish the Guildie and grants no Guild Operations capability.

```text
guildie_id
discord_user_id
username
connected_at
```

The Discord user ID is the durable Discord coordinate. Username is minimal recognition metadata only.

The one-to-one association remains durable while the module is disabled. Re-enabling Discord restores the module's ability to use that association without requiring the Guildie to reconnect.

## Guildie observation

`discordStateForGuildie(guildie_id)` begins with an existing Guildie and a module-owned Discord association, then asks Discord for that known user in the configured server.

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

The current integration uses direct Discord REST acquisition for associated users. It does not list the entire server membership and does not use a Gateway connection.

## Managed projections

The module manages two role families.

### Linked Role

Desired state is:

```text
current Blizzard-backed guild membership
AND Discord association exists
AND associated Discord user is currently in the server
→ Linked Role present

otherwise
→ Linked Role absent
```

Possessing the Linked Role never creates or proves an association.

### Rank Mapping

Rank Mapping projects Blizzard-owned current rank through Guild Operations authority into configured Discord roles.

```text
Blizzard current rank
    ↓
Guild Operations effective authority
    ↓
Discord module guild-rank → Discord-role mapping
    ↓
Discord role assignment
```

Lower numeric Blizzard rank indexes represent higher authority. A Guildie receives the configured role for their effective rank and every configured lower-authority role below it.

Discord role possession never grants a Guild Operations capability. It may only serve as a cheap preflight signal for Discord-side interaction.

## Evaluation and mutation

Evaluation and mutation are separate.

```text
authoritative Guild Operations change commits
    ↓
confirm current Guildie authority
    ↓
resolve Discord association
    ↓
read Discord-owned state
    ↓
apply enabled Linked Role / Rank Mapping policy
    ↓
calculate planned additions/removals
    ↓
execute only mutations belonging to enabled mappings
```

Evaluation exposes:

```text
desiredRoleIds
currentManagedRoleIds
plannedAddRoleIds
plannedRemoveRoleIds
observedAt
```

A disabled mapping is retained as configuration but does not participate in desired-role evaluation or reconciliation. The other mapping may remain enabled and continue operating independently.

Mutation results separately expose added and removed role IDs. Unrelated human-managed Discord roles are never replaced or removed.

Bulk reconciliation uses the same evaluator and role operations with bounded concurrency. Discord HTTP 429 responses honor provider retry guidance with bounded retries.

Evaluation remains internal machinery used by reconciliation. Guild Operations does not expose a separate Pending actions or reconciliation-preview administrative surface because enabled Role Maps are reconciled directly rather than staged for later approval.

## Reconciliation triggers

Discord owns no independent scheduler.

Current triggers are:

- Discord association establishment;
- Discord disassociation;
- guild refresh when Guildie membership/rank context changes;
- saved Role Maps configuration changes;
- enabling Linked Role or Rank Mapping.

Core guild refresh does not import or call Discord directly. It publishes a narrow guild-refresh observation after authoritative guild state commits. The packaged Discord module registers an observer for that concrete operation and reconciles only when the module is enabled and direct Discord integration is configured.

This observer is intentionally not the future general application event bus. It exists because Discord already demonstrated a concrete dependency on guild refresh. A broader event bus remains deferred until multiple real application facts establish its contract.

## Operational inspection

Discord publishes administrator-useful operational history through the shared operational-inspection system.

Single-Guildie reconciliation uses:

```text
source: discord
operation: roles.reconcile
```

Bulk reconciliation uses:

```text
source: discord
operation: roles.reconcile.bulk
```

Normal completed Discord work is published as `kind: result`, including successful reconciliation and successful no-op outcomes already emitted by the owning operation.

A Discord operation that cannot complete its intended work is published as `kind: exception`. This includes single-Guildie mutation failures, incomplete role cleanup after disassociation, and bulk reconciliation where one or more Guildies fail evaluation or mutation. Bulk exceptions retain the useful aggregate counts plus safe per-Guildie failure coordinates so an administrator can see what completed and what did not.

Operational-inspection publication is best effort relative to Discord behavior. Failure to write an inspection record does not change the Discord operation and remains runtime logging.

Secrets, OAuth material, authorization headers, and raw Discord payloads must never be recorded in operational inspection.

Discord operational history and exceptions are inspected through the global surface:

```text
/admin/operations
```

## Web presentation

When enabled, the Discord module contributes its own presentation to shared web surfaces:

- the compact Discord association interaction in the authenticated `Me` menu;
- the configured Discord community link in the footer;
- the configured Discord invitation action on the guild home page.

Core web rendering consumes these as module presentation contributions and does not own Discord-specific state or behavior.

When the module is disabled, those contributions disappear while core Guild Operations remains valid and usable.

## Boundaries

Discord may consume core Guild, Guildie, Character, authority, administration, presentation, and operational-inspection contracts. Core does not depend on Discord to define any of those objects.

Other modules should not directly consume Discord merely because Discord data is convenient. The Raffle module's former Discord username fallback has been removed. Module-to-module interaction will be designed later only when concrete cross-module requirements earn it.

The eventual first-party Discord bot is outside this extraction. The module currently preserves the existing direct Discord behavior; a packaged bot may be added later without making that bot the owner of Guild Operations truth.
