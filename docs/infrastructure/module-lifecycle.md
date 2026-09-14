# Packaged Module Lifecycle

Guild Operations distinguishes whether a packaged module is available to the installation from whether that module is enabled for use.

Current lifecycle state is deliberately small:

```text
packaged with the application
        ↓
enabled for this guild
        ↓
module-specific configuration
        ↓
participation and operations
```

Future acquisition or entitlement may determine whether a module is available at all, but no licensing or commerce machinery is implemented by this facility.

## Current packaged modules

The current packaged modules are:

- Raffle;
- Raid;
- Discord.

Raffle and Raid default to enabled so introducing lifecycle state preserves existing guild behavior. Discord defaults to disabled, matching its established packaged-integration behavior.

## Persistence

Per-guild module enablement is persisted in `guild_module_enablement` using the stable module key as the coordinate.

Enablement is global Guild Operations state. A module may own configuration required for its own behavior, but it must not establish a second authoritative enablement flag.

Discord predates the global lifecycle contract and still has a legacy `discord_module_settings.enabled` column. During migration that column is used to seed the global state, and current writes mirror global enablement into it for compatibility. Consumers resolve Discord enablement through the global lifecycle contract rather than treating the legacy column as authoritative.

## Administration

Module enablement is configured from:

```text
Administration → General → Modules
```

Changing module enablement requires the global capability:

```text
modules.configure
```

The configured operator may also perform this administration. The initial migration grants `modules.configure` to Blizzard guild rank 0.

Module enablement is distinct from module-specific configuration. A disabled module may remain configurable where preparing its configuration before enablement is useful. Discord currently demonstrates this behavior.

## Runtime behavior

Disabling a module prevents its participation and operational surfaces from being used and removes its discoverable projections where applicable.

Current behavior includes:

- disabled Raffle and Raid web and module API routes refuse requests;
- disabled Raffle and Raid offerings/calendar entries are omitted from web event discovery;
- disabled module-backed calendar entries are omitted from the read-facing global calendar API;
- the home-page Raffle promotion is absent while Raffle is disabled;
- disabled Discord removes Discord member-facing presentation and prevents Discord runtime integration from operating;
- administrative configuration that is intentionally independent of operational use may remain reachable while the module is disabled.

Disabling a module does not delete its durable domain history. Existing Raffle rounds, Raid records, calendar projections, Discord configuration, and similar module-owned facts remain persisted unless their owning procedure has a separate reason to change them.

## Ownership boundary

This facility owns only packaged-module enablement and the small packaged-module identity needed to resolve it.

It does not own:

- module procedure;
- module-specific configuration;
- permission policy beyond the authority required to change enablement;
- event discovery truth;
- acquisition or entitlement;
- licensing, billing, or premium tiers.

Do not grow this into a generic plugin loader or entitlement framework. Add another lifecycle distinction only when a concrete module or distribution requirement proves it is needed.
