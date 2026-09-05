# Secondary Navigation

Guild Operations reserves the space immediately below primary navigation for optional secondary navigation.

This zone belongs to the shared web renderer. Individual modules should register secondary navigation with `renderPage(...)` rather than placing their own breadcrumb or back-link navigation inside the page header.

If a page does not register secondary navigation, the zone is not rendered and no empty vertical space is reserved.

## Renderer contract

The registration type is exported from:

```text
src/web/render.ts
```

`renderPage(...)` accepts the optional field:

```ts
secondaryNavigation?: SecondaryNavigation;
```

The renderer currently supports two forms.

### Back navigation

Use a back link when the useful action is to return to one clear parent or owning surface.

```ts
secondaryNavigation: {
  kind: "back",
  label: "Back to raffle",
  href: "/events/raffle",
},
```

The renderer supplies the arrow, semantic `<nav>`, shared styling, and placement below primary navigation.

Pages should provide the destination label without a manually embedded arrow.

Typical uses include focused child surfaces such as entry forms, claim views, rules pages, and module-specific history.

### Breadcrumb navigation

Use breadcrumbs when the page is part of a meaningful hierarchy whose intermediate locations are useful to expose.

```ts
secondaryNavigation: {
  kind: "breadcrumb",
  items: [
    { label: "Administration" },
    { label: "Raffle", href: "/admin/raffle" },
    { label: "Sep 7 Raffle" },
  ],
},
```

The renderer owns separators, breadcrumb semantics, terminal `aria-current`, shared styling, and placement.

A breadcrumb item may provide `href` when it represents a navigable ancestor. The terminal item is presented as the current location rather than a link.

## Page identity remains separate

Secondary navigation does not replace the page header or its eyebrow.

The intended page structure is:

```text
Primary navigation

[optional secondary navigation]

[page identity]
  eyebrow
  title
  optional lede

[page content]
```

Eyebrows remain presentation/context language. Secondary navigation communicates where the user can move within the application hierarchy.

For example:

```text
← Back to raffle

EVENTS · RAFFLE
Rules and Regulations
```

or:

```text
ADMINISTRATION › RAFFLE › SEP 7 RAFFLE

Manage raffle
```

## Module guidance

When adding a new module or expanding an existing module:

- do not create module-local breadcrumb markup if the shared renderer can express the navigation;
- do not place back links inside `header` merely to position them above the eyebrow;
- register secondary navigation through `renderPage(...)`;
- use `kind: "back"` for a single obvious return destination;
- use `kind: "breadcrumb"` for a meaningful navigable hierarchy;
- omit `secondaryNavigation` entirely when the page has no secondary navigation requirement.

The renderer intentionally owns this zone so that new modules share the same placement, accessibility semantics, and vertical rhythm without copying presentation code.

## Current examples

Current usages can be found in the raffle web surfaces under:

```text
src/web/pages/events/raffle/
```

Examples include:

- member-facing raffle child pages using back navigation;
- raffle administration using breadcrumb navigation.

The shared implementation itself remains authoritative in `src/web/render.ts`. This document describes how modules should consume that renderer contract; it should not become a second implementation definition.
