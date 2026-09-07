# Web Rendering Infrastructure

Guild Operations' web layer owns presentation composition and delivery. Routes assemble presentation-ready values; rendering code does not query the database, make authority decisions, or manufacture backend truth.

## Application shell

The shared shell owns application-level presentation including:

- primary navigation;
- optional secondary navigation;
- shared action surfaces;
- responsive shell behavior;
- common page composition;
- persistent member context.

Authenticated member context is projected from the current Guildie. Selected-main or Character imagery may improve recognition but does not determine continuity or authorization.

## Shared controls

Standard interactive controls use the global presentation fallback unless a narrower semantic owner has a real reason to differ.

Current shared fallback covers ordinary buttons/button-like actions, text and number inputs, text areas, selects, focus/disabled states, and switch presentation for boolean enabled/disabled controls.

Presentation precedence is:

1. global shell fallback;
2. producer-scoped refinement or override;
3. rare inline exception.

Checkbox semantics remain distinct from switch semantics. A boolean enabled/disabled state may use switch presentation while retaining a native checkbox input; ordinary checkbox choices should not become switches merely because they share the input type.

## Authorization boundary

Rendering may express the result of an authorization decision by showing, hiding, disabling, or labeling an interaction appropriately. It does not make or enforce that decision.

A missing or disabled control is presentation, not access control. Routes and procedures must still enforce required capabilities against backend authority through [`guild-permissioning.md`](guild-permissioning.md) or the appropriate module-owned authorization policy.

## Secondary navigation

Pages declare navigation intent; the shared renderer owns presentation.

Two relationships are supported:

```text
breadcrumb
    → durable application location

back
    → return destination from a focused interaction
```

For breadcrumbs, pages supply semantic hierarchy and navigable destinations where applicable. The renderer owns separators, current-location treatment, styling, placement, accessibility, and constrained-space behavior.

For back navigation, pages supply destination and label. The renderer owns visual and accessibility treatment.

Use the semantic distinction **location versus return from an interaction**, not URL shape alone.

## Rendering ownership

Use the broadest owner already earned:

1. global rendering for shared application language;
2. module rendering for reusable module-specific presentation;
3. inline rendering for genuinely exceptional one-off surfaces.

Navigation belongs to the shell. Page and module identity—titles, section labels, event states, and domain status treatments—belongs to the page/module.

## Application origin

`APP_ORIGIN` is the canonical externally visible application origin. Public URLs and OAuth callbacks derive from it rather than hardcoded deployment addresses.

The local process listen port is independent of the externally visible origin.

## Asset delivery

Shared web assets use content-derived addressing so changed content receives a new URL and unchanged content remains safely cacheable.

Rendered HTML remains revalidatable so current interface state is not made stale by long-lived document caching.

Implementation may evolve, but cache behavior must preserve the distinction between immutable versioned assets and current rendered application state.

## Growth rule

Promote shared rendering only after real application pressure demonstrates common interaction or presentation behavior. The goal is fallback uniformity, not a speculative component or design-system framework.
