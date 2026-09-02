import { config } from "../config.js";
import { assetUrl, type AssetRegistry } from "./assets.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type WebViewer =
  | { authenticated: false }
  | {
      authenticated: true;
      mainCharacter: {
        name: string;
        avatarUrl: string | null;
      } | null;
    };

export type RenderPageInput = {
  pathname: string;
  title: string;
  description?: string;
  header: string;
  body: string;
  viewer: WebViewer;
};

function userGlyph(): string {
  return `<svg class="account-glyph" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="8" r="4"></circle>
    <path d="M4.8 20c.8-4 3.2-6 7.2-6s6.4 2 7.2 6"></path>
  </svg>`;
}

function renderMeControl(viewer: WebViewer): string {
  if (!viewer.authenticated) {
    return `<a class="me-control" href="/auth/blizzard/start?return_to=/" aria-label="Sign in">
      <span>Sign in</span>
      <span class="account-visual account-visual-generic">${userGlyph()}</span>
    </a>`;
  }

  const label = viewer.mainCharacter?.name ?? "Me";
  const portrait = viewer.mainCharacter?.avatarUrl
    ? `<img src="${escapeHtml(viewer.mainCharacter.avatarUrl)}" alt="" loading="eager" referrerpolicy="no-referrer">`
    : userGlyph();

  return `<details class="me-menu menu-surface">
    <summary class="me-control">
      <span>${escapeHtml(label)}</span>
      <span class="account-visual${viewer.mainCharacter?.avatarUrl ? " account-visual-portrait" : " account-visual-generic"}">${portrait}</span>
    </summary>
    <div class="menu-panel menu-panel-right">
      <a href="/select-main">Select main</a>
      <button type="button" data-logout>Sign out</button>
    </div>
  </details>`;
}

function renderActionBar(viewer: WebViewer, pathname: string): string {
  const homeActive = pathname === "/" ? ' aria-current="page"' : "";

  return `<nav class="action-bar" aria-label="Primary navigation">
    <div class="action-bar-inner">
      <details class="mobile-nav menu-surface">
        <summary class="icon-control" aria-label="Open navigation">
          <span></span><span></span><span></span>
        </summary>
        <div class="menu-panel menu-panel-left">
          <a href="/"${homeActive}>Home</a>
        </div>
      </details>
      <div class="desktop-nav">
        <a href="/"${homeActive}>Home</a>
      </div>
      <div class="action-bar-spacer"></div>
      ${renderMeControl(viewer)}
    </div>
  </nav>`;
}

export function renderPage(assets: AssetRegistry, input: RenderPageInput): string {
  const title = escapeHtml(input.title);
  const description = escapeHtml(input.description ?? "OH CRIT I Pulled! Guild Operations");
  const canonicalUrl = new URL(input.pathname, config.appOrigin).toString();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${description}">
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="stylesheet" href="${assetUrl(assets, "app.css")}">
  <title>${title}</title>
</head>
<body>
  <div class="app-shell">
    ${renderActionBar(input.viewer, input.pathname)}
    <header class="page-header">${input.header}</header>
    <main class="app-main">${input.body}</main>
    <footer class="app-footer">OH CRIT I Pulled! Guild Operations</footer>
  </div>
  <script src="${assetUrl(assets, "app.js")}" defer></script>
</body>
</html>`;
}

export function htmlText(value: string): string {
  return escapeHtml(value);
}
