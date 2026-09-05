# Module Creation Guidance

Guild Operations modules should be built around concrete guild participation capabilities rather than generalized framework machinery.

A module should establish or operate a real guild activity, preserve its history, or provide the authority needed to participate in it. Shared abstractions should emerge from repeated real pressure rather than being designed in advance.

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
