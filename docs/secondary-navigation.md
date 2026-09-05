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

### Breadcrumb navigation

Breadcrumbs are the standard expression for a page that occupies a durable location within one of the application realms established by primary navigation. They answer where the user is in that realm.

```ts
secondaryNavigation: {
  kind: "breadcrumb",
  items: [
    { label: "Events" },
    { label: "Raffle" },
  ],
},
```

The first breadcrumb may be an inert root corresponding to the primary-navigation realm. Its purpose is orientation: it confirms which realm owns the hierarchy without duplicating the primary navigation's responsibility for navigating to that realm.

Deeper durable locations can expose navigable intermediate ancestors while retaining an inert realm root and a non-navigable current location:

```ts
secondaryNavigation: {
  kind: "breadcrumb",
  items: [
    { label: "Events" },
    { label: "Raffle", href: "/events/raffle" },
    { label: "Previous Raffles" },
  ],
},
```

The renderer owns separators, breadcrumb semantics, terminal `aria-current`, shared styling, placement, and constrained-space behavior.

A breadcrumb item may provide `href` when it represents a navigable ancestor. The terminal item is presented as the current location rather than a link.

### Back navigation

Back navigation is useful when a page is better understood as a focused interaction branching from an owning surface than as another durable location in the application's hierarchy. It answers where the user should return after that interaction.

```ts
secondaryNavigation: {
  kind: "back",
  label: "Back to raffle",
  href: "/events/raffle",
},
```

The renderer supplies the arrow, semantic `<nav>`, shared styling, and placement below primary navigation.

Pages should provide the destination label without a manually embedded arrow.

Session- or guildie-specific participation surfaces are a strong signal for this form. For example, entering a raffle or viewing one's own claims can reasonably return directly to the raffle surface rather than presenting themselves as durable locations in the Events hierarchy.

This is guidance rather than a mechanical classification rule. The useful distinction is whether secondary navigation is primarily expressing **location** or **return from a focused interaction**.

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

Eyebrows remain presentation/context language owned by the page or module. Secondary navigation communicates application hierarchy or return behavior and receives its presentation from the shared navigation system.

For example, a durable raffle reference page may present:

```text
Events › Raffle › Rules and Regulations

EVENTS · RAFFLE
Rules and Regulations
```

while a focused participation surface may present:

```text
← Back to raffle

EVENTS · RAFFLE
Claims
```

The capitalization and styling shown by secondary navigation are renderer concerns; modules provide semantic labels rather than encoding navigation presentation into those labels.

## Module guidance

When adding a new module or expanding an existing module:

- do not create module-local breadcrumb markup if the shared renderer can express the navigation;
- do not place back links inside `header` merely to position them above the eyebrow;
- register secondary navigation through `renderPage(...)`;
- prefer `kind: "breadcrumb"` for durable locations within a primary-navigation realm;
- let the breadcrumb root act as an inert realm marker when primary navigation already owns navigation to that root;
- use navigable intermediate breadcrumbs when they represent useful ancestor locations;
- consider `kind: "back"` for focused participation or work surfaces whose useful relationship is return to one owning location;
- treat session- or guildie-specific interaction as a strong signal for back navigation, not an absolute rule;
- omit `secondaryNavigation` entirely when the page has no secondary navigation requirement.

These are consumption guidelines rather than route-derived laws. Choose the form that best communicates the page's actual relationship to the surrounding application.

The renderer intentionally owns this zone so that new modules share the same placement, accessibility semantics, responsive behavior, capitalization presentation, and vertical rhythm without copying presentation code.

## Current examples

Current usages can be found in the raffle web surfaces under:

```text
src/web/pages/events/raffle/
```

As those surfaces conform to this guidance, durable raffle locations should use breadcrumbs while focused member participation surfaces may use back navigation.

The shared implementation itself remains authoritative in `src/web/render.ts`. This document describes how modules should consume that renderer contract; it should not become a second implementation definition.
