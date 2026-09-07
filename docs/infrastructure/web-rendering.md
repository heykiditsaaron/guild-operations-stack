# Web Rendering Boundary

Guild Operations' web layer owns presentation composition and delivery. It does not redefine operational truth supplied by the backend.

The renderer should grow from real application needs rather than predicted information architecture.

## Projection contract

Routes acquire or assemble view data, then hand presentation-ready values to the renderer. Rendering code must not perform database queries, make authority decisions, or manufacture backend state.

Presentation-owned content may follow different authority rules when such systems are introduced. That does not permit the web layer to counteract authoritative backend state.

## Application shell

The shared shell owns application-level presentation such as:

- primary navigation;
- optional secondary navigation;
- shared action surfaces;
- responsive shell behavior;
- common page composition; and
- persistent member context.

The renderer may change presentation across breakpoints without changing the meaning of the interaction or navigation it represents.

The authenticated member context is projected from the current Guildie. A selected main or Character portrait may improve recognition, but those presentation choices do not determine Guildie continuity or authorization.

`Subject` is not a rendering identity object. If a page has a grammatical or domain subject, that role belongs to the concrete object the page is about.

## Shared interaction presentation

Standard interactive controls are global presentation infrastructure. Feature surfaces consume the shared fallback language rather than redefining ordinary controls by default.

The shared fallback currently covers ordinary buttons and button-like actions, text/number inputs, text areas, selects, focus and disabled states, and switch presentation for boolean enabled/disabled controls.

This is not a requirement for every interaction to look identical. A producer may define scoped CSS when its domain genuinely requires a different treatment, and rare exceptional surfaces may override presentation inline when neither the global nor producer scope is the correct owner. The precedence is therefore:

1. global shell fallback;
2. producer-scoped refinement or override; and
3. rare inline exception.

Checkbox semantics remain distinct from switch semantics. A boolean control whose meaning is an enabled/disabled state may use the shared switch presentation while retaining a native checkbox input for semantics and accessibility. Ordinary checkbox choices should not become switches merely because they use the same HTML input type.

Shared presentation should be promoted only after real application pressure demonstrates a common interaction. The purpose is fallback uniformity, not a speculative component or design-system framework.

## Secondary navigation

The shared renderer owns the optional navigation zone immediately below primary navigation. Modules and pages declare navigation intent; they do not reproduce shared breadcrumb or back-link presentation locally.

Secondary navigation currently expresses two distinct relationships:

```text
breadcrumb
    → where is this durable location in the application?

back
    → where should this focused interaction return?
```

A breadcrumb is appropriate for a durable location within an application realm. Items are declared in semantic hierarchy order. Navigable ancestors may supply destinations; the terminal item represents the current location. The renderer owns separators, current-location semantics, styling, placement, accessibility, and constrained-space behavior.

A breadcrumb root may remain inert when a higher navigation layer already owns movement to that realm. It may be navigable when no higher layer owns that movement and a real parent surface exists. This is an ownership distinction, not a route-specific rule.

Back navigation is appropriate when a surface is better understood as a focused interaction branching from one owning surface than as another durable location. The page supplies the semantic destination and label; the renderer owns the visual and accessibility treatment.

The useful distinction is **location versus return from an interaction**, not a mechanical classification derived from URL structure.

Secondary navigation remains separate from page identity. Breadcrumbs or back navigation communicate application relationship; eyebrows, titles, states, and other identity cues remain owned by the page or module.

## Rendering ownership

Rendering ownership follows semantic ownership:

1. **Global rendering** for presentation that belongs to the shared application language.
2. **Module rendering** for reusable presentation that belongs specifically to a module.
3. **Inline rendering** for genuinely exceptional surfaces with no demonstrated reusable owner.

Do not promote one-off presentation merely to create reuse, and do not duplicate shared shell or navigation behavior inside modules.

## Application origin

`APP_ORIGIN` is the canonical externally visible application origin. Public application URLs are derived from it rather than hardcoded deployment addresses.

The local process listen port remains independent of the externally visible origin.

OAuth callback URLs should be derived from the canonical application origin rather than introducing competing deployment coordinates.

## Asset delivery

Shared web assets should use content-derived addressing so changed content receives a new URL while unchanged assets remain safely cacheable.

Rendered HTML should remain revalidatable so interface state is not made stale by long-lived document caching.

The implementation may evolve, but cache behavior must preserve the distinction between immutable versioned assets and current rendered application state.

## Page and module identity

Navigation presentation is global shell behavior. Page and module identity presentation is local.

The shell owns navigation hierarchy, active/current treatment, responsive behavior, spacing, casing, separators, and shared accessibility semantics.

Modules own identity cues whose meaning belongs to their domain, including page titles, section labels, event states, and status treatments.

Do not use module-specific identity styling to recreate navigation behavior, and do not push module identity into the shared navigation renderer.
