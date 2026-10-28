# Installation lifecycle

Guild Operations distinguishes three operations by what continuity they preserve.

- **Reset** retains the installation and its Blizzard guild binding, clears guild-owned configuration, and preserves history. Reset is not implemented by rebinding.
- **Rebind** retains the installation and its historical records, changes the authoritative Blizzard guild identity to a different guild, and resets guild-owned configuration. The host explicitly establishes the destination in its environment, confirms the request, and the destination Guild Master authorizes it. An unchanged identity or renamed guild is not a rebind.
- **Reinstall** destroys the installation's persisted bindings, configuration, identities, associations, participation, and history. It returns to an uninitialized state. Recovery depends on an independently retained backup. Reinstall is explicitly destructive and is not a reset or rebind.

These definitions are contracts; documenting reset and reinstall does not imply their commands are implemented.

## External responsibility boundary

Discord and other providers retain authority over their own persisted resources. Reset, rebind, and reinstall relinquish responsibility for external projections and pending actions that belong to the previous configuration or installation. The application must prevent abandoned callbacks and delayed workers from reestablishing authority over new configuration. Best-effort cleanup may be attempted, but deletion of external messages, actions, or provider history cannot be guaranteed. A completed lifecycle transition must not imply external cleanup succeeded.
