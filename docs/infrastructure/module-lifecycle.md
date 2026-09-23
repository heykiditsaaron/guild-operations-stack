# Packaged Capability Lifecycle

Guild Operations currently has a small enablement facility that predates the Core / Module / Plugin taxonomy. It distinguishes whether a packaged capability is available to the installation from whether that capability is enabled for use.

Product ownership and distribution are separate concerns. A capability being packaged, optional, configurable, enabled, disabled, or eventually entitled does not determine whether it is Core, a Module, or a Plugin.

Current lifecycle state is deliberately small:

```text
packaged with the application
        ↓
enabled for this guild
        ↓
capability-specific configuration
        ↓
operational use
```

Future acquisition or entitlement may determine whether a capability is available at all, but no licensing or commerce machinery is implemented by this facility.

## Current packaged capabilities

The current facility tracks:

- Raffle — Module;
- Raid — Module;
- Discord — Plugin.

Raffle and Raid default to enabled so introducing lifecycle state preserves existing guild behavior. Discord defaults to disabled, matching its established packaged-integration behavior.

The implementation still uses historical `module` naming such as `guild_module_enablement`, `PackagedModuleKey`, and `modules.configure`. Those names are structural conformity debt. They do not reclassify Discord as a Module and should be corrected deliberately during the Core / Module / Plugin alignment rather than by introducing parallel authority.

## Persistence

Per-guild packaged-capability enablement is currently persisted in `guild_module_enablement` using the stable capability key as the coordinate.

Enablement is global Guild Operations state. An owning Module or Plugin may own configuration required for its own behavior, but it must not establish a second authoritative enablement flag.

Discord predates the global lifecycle contract and still has a legacy `discord_module_settings.enabled` column. During migration that column was used to seed the global state, and current writes mirror global enablement into it for compatibility. Consumers resolve Discord enablement through the global lifecycle contract rather than treating the legacy column as authoritative.

## Administration

Packaged capability enablement is currently configured from:

```text
Administration → Modules
```

The current persisted capability key authorizing this administration is:

```text
modules.configure
```

That key is historical compatibility state and must not be renamed casually because persisted permission mappings may depend on it. The configured operator may also perform this administration.

Enablement is distinct from capability-specific configuration. A disabled capability may remain configurable where preparing its configuration before enablement is useful. Discord currently demonstrates this behavior.

## Runtime behavior

Disabling a packaged capability prevents its participation or operational surfaces from being used and removes active owned presentation where applicable.

Current behavior includes:

- disabled Raffle and Raid web and module API routes refuse requests;
- disabled Raffle and Raid participation offerings are omitted from activity discovery;
- the home-page Raffle promotion is absent while Raffle is disabled;
- disabled Discord removes Discord member-facing presentation and prevents Discord runtime integration from operating;
- administrative configuration intentionally independent of operational use may remain reachable while the capability is disabled.

Calendar is Core and is not governed by packaged Module/Plugin enablement merely because it consumes projections from Modules. Disabling a Module does not transfer its domain truth into Calendar.

Disabling a capability does not delete its durable domain history or configuration. Existing Raffle rounds, Raid records, Discord configuration, and similar owned facts remain persisted unless their owning procedure has a separate reason to change them.

## Ownership boundary

This facility owns only the currently earned packaged-capability enablement state and the small packaged identity needed to resolve it.

It does not own:

- Module procedure;
- Plugin integration procedure;
- capability-specific configuration;
- permission policy beyond the authority required to change enablement;
- Calendar behavior or Calendar projection truth;
- acquisition or entitlement;
- licensing, billing, or premium tiers.

Do not grow this into a generic Module loader, Plugin loader, extension runtime, or entitlement framework. Add another lifecycle distinction only when a concrete capability or distribution requirement proves it is needed.
