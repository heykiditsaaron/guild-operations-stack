# Module Creation Guidance

Guild Operations modules should be built around concrete guild participation capabilities rather than generalized framework machinery.

A module should establish or operate a real guild activity, preserve its history, or provide the authority needed to participate in it. Shared abstractions should emerge from repeated real pressure rather than being designed in advance.

## Source ownership

Concrete participation modules belong under `src/modules/<module>/` once the application has earned a module boundary for that capability. This is an implementation ownership boundary, not a requirement that source layout mirror member-facing URLs.

A module may establish Guild Event registrations without being contained by Guild Events. Shared Guild Event registration and registry machinery belongs to `src/guild-events/`, while a member-facing projection may still appropriately live under `src/web/pages/events/`.

Raffle is the current concrete example: raffle procedure and truth belong to `src/modules/raffle/`, while `/events/raffle` remains the appropriate member-facing route.

The `src/modules/` container does not imply a generic module loader, registry, lifecycle, or framework. Add shared module machinery only when multiple concrete participation capabilities demonstrate that the same machinery is actually needed.

## Persistence and shared authority

A module owns the persistence of the participation truth it establishes. It does not duplicate persistence owned globally by Guild Operations.

Global Guild Operations owns shared authoritative facts and objects such as Guildies, controlled Characters, current Blizzard guild roster observations, Blizzard rank observations, and other application-wide authority state.

A module may reference those globally owned objects while persisting the module-specific meaning of their participation. Referencing a Guildie, Character, guild, rank, or other global coordinate does not transfer ownership of that object or fact to the module.

A module should name the actual object and relationship it persists. `Subject` is contextual language, not a global object or persistence coordinate, and must not be introduced as a generic module reference.

Modules remain subject to application-wide persistence laws and conventions even when the persisted facts belong to the module.

## Permissioning

Global Guild Operations owns permissions for globally owned operations and exposes globally authoritative member, roster, rank, and authority facts.

Modules consume those facts and global permissions as inputs. A module owns permission policy that belongs specifically to its participation procedure.

Module authorization may derive a module-specific decision directly from current global authority facts, require an existing globally owned permission, or introduce module-specific permission state when a real module requirement proves that additional state is necessary. These mechanisms may coexist; ownership determines which layer defines the rule.

A module capability is a semantic permission, not necessarily a globally persisted grant. A module may define a capability such as `raffle.admin` and evaluate it from current global facts without registering that capability as global permission state.

Modules should not duplicate globally owned roster, rank, Guildie, Character, or authority state merely to make a permission decision. Global facts remain globally owned; the module owns only its interpretation of those facts for its own procedure.

Using global permission machinery does not transfer ownership of module-specific permission policy to the global layer. Conversely, a module should not reimplement globally owned permission semantics merely because it has local authorization needs.

The default for a new module is to begin with existing global facts and permissions. Add module-specific permission machinery only when the module's procedure demonstrates a need that those inputs cannot express directly.

## Rendering ownership

Use the broadest rendering owner that has already been earned by the application.

### Prefer global rendering

If presentation belongs to the shared application language, let the global renderer own it.

Examples include:

- application shell structure
- primary navigation
- secondary navigation
- shared navigation semantics
- shared navigation spacing, casing, collapse, separators, and current-state treatment

Modules should declare the semantic information the global renderer needs rather than reproducing global presentation locally.

For secondary navigation, this means the module declares navigation intent and hierarchy while the shared renderer owns the resulting semantics and presentation. Breadcrumb order is significant: the terminal item is the module's declaration of the current location.

### Attach module-specific rendering

When presentation genuinely belongs to a module and is reused across that module, attach it to the module rather than promoting it into the global renderer.

This is appropriate for presentation that expresses module-specific concepts, states, controls, or recurring surfaces without being part of the application's shared visual language.

A module-specific renderer should remain scoped to the module unless another real feature demonstrates that the same ownership belongs somewhere broader.

### Use inline rendering only when exceptional

Inline rendering is appropriate when the presentation belongs only to one exceptional page, state, or interaction and has no demonstrated reusable owner.

Do not extract one-off presentation merely to avoid inline code. Do not promote exceptional presentation into module or global rendering until repeated use proves that a broader owner exists.

## Rendering hierarchy

The preferred order is:

1. Global render, when the application owns the presentation.
2. Module-specific render, when the module owns reusable presentation.
3. Inline render, when the surface is genuinely exceptional.

This is an ownership hierarchy, not a rule that every piece of markup must be abstracted. Start at the broadest already-earned owner, but do not move presentation upward simply to make code look more reusable.

Global rendering should not become a dumping ground. Module rendering should not become a speculative design system. Inline rendering should not become the default for concepts that are clearly shared.

## Navigation and page identity

Navigation presentation is global shell behavior. Page and module identity presentation is local.

The shell owns navigation concerns such as:

- hierarchy presentation
- active and current treatment
- spacing
- casing
- collapse and overflow behavior
- separators
- responsive behavior

The module owns identity cues such as page titles, section labels, event states, status treatments, and other presentation whose meaning belongs to the module itself.

Do not use page-specific identity styling to recreate navigation behavior, and do not push module identity into the global navigation renderer.

## General guidance

Build the guild activity first. Let common machinery reveal itself under real use.

Prefer concrete module boundaries over generalized infrastructure. Prepare inexpensive semantic seams for likely future expression when justified, but do not create speculative features or frameworks around them.

When a module needs shared behavior, first ask which layer legitimately owns that behavior. Reuse should follow ownership; ownership should not be invented merely to create reuse.
