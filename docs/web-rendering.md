# Web Rendering Boundary

Guild Operations' web layer owns presentation composition and delivery. It does not redefine operational truth supplied by the backend.

The renderer is intentionally small and grows with real application needs rather than predicted information architecture.

## Projection contract

Routes acquire or assemble view data, then hand presentation-ready values to the renderer. Rendering code must not perform database queries, make authority decisions, or manufacture backend state.

Presentation-owned content such as articles, announcements, and editorial material may follow different authority rules when those systems are introduced. That does not permit the web layer to counteract authoritative backend state.

## Application shell

The current shell is:

```text
Action bar
Header
Main
Footer
```

The action bar is currently reserved for navigation and immediate user interactions. That is a first-design-phase choice rather than permanent doctrine; the shell may evolve when real needs justify it.

Navigation is deliberately sparse. Mobile presents it through a hamburger menu and larger screens expose the same destinations directly. The renderer changes presentation across breakpoints, not navigation meaning.

The right side of the action bar is the Me surface. A signed-out viewer receives a Blizzard sign-in action and generic account glyph. A signed-in viewer is projected from the authenticated Guildie and, when selected, presents the current main character name and Blizzard portrait. The selected main remains presentation state and does not determine Guildie continuity or authorization.

The current Me menu contains only capabilities that already exist: selecting a main character and signing out.

Main selection is a shell interaction rather than a separate application destination. The shell receives the Guildie's currently eligible guild Characters as presentation-ready data, opens a responsive character picker over the current page, and submits the selected durable Character coordinate to `PUT /me/main-character`. Successful selection updates the current Me presentation without navigating away from the active page. The backend remains the authority for eligibility and persistence.

On mobile the picker is presented as a bottom sheet. On larger screens the same interaction is presented as a centered dialog. This is one interaction contract with responsive presentation, not two separate features.

`Subject` is not a rendering identity object. If a page has a grammatical or domain subject, that role belongs to whichever concrete object the page is about and does not affect authenticated Guildie resolution.

## Application origin

`APP_ORIGIN` is the canonical externally visible application origin. It contains only scheme, host, and optional port. Public application URLs are derived from it rather than hardcoded deployment addresses.

`PORT` remains the local process listen port and is independent of the external origin.

The Blizzard OAuth callback is derived as `/auth/blizzard/callback` beneath `APP_ORIGIN`; `BLIZZARD_REDIRECT_URI` is no longer independently configured.

## Asset delivery and cache busting

Shared web assets are loaded when the application starts. Each asset receives a URL containing the first twelve hexadecimal characters of its SHA-256 content digest, for example:

```text
/assets/app.<content-hash>.css
```

Changing asset content therefore changes its address automatically. Fingerprinted assets are served with:

```text
Cache-Control: public, max-age=31536000, immutable
```

Rendered HTML is served with:

```text
Cache-Control: no-cache
```

This makes stale CSS or JavaScript structurally unable to survive a content change while allowing unchanged assets to remain cached efficiently.

## Current scope

`GET /` is the first page rendered inside the shared application shell. Its navigation currently contains only Home.

The former standalone `/select-main` page has been retired. Main selection now belongs to the shared Me interaction surface and can remain available while the member stays on the page they were already using.
