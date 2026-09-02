# Web Rendering Boundary

Guild Operations' web layer owns presentation composition and delivery. It does not redefine operational truth supplied by the backend.

The initial renderer is intentionally small. `GET /` is the first web projection and exists primarily as a stable surface for growing presentation behavior.

## Projection contract

Routes acquire or assemble view data, then hand presentation-ready values to the renderer. Rendering code must not perform database queries, make authority decisions, or manufacture backend state.

Presentation-owned content such as articles, announcements, and editorial material may follow different authority rules when those systems are introduced. That does not permit the web layer to counteract authoritative backend state.

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

The renderer currently owns only the new `/` splash page and its shared assets. `/select-main` remains untouched until its eventual place in the web application is deliberately designed.
