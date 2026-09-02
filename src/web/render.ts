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

export type WebViewerCharacter = {
  characterId: string;
  realmId: string;
  name: string;
  realmName: string | null;
  rankIndex: number;
  level: number | null;
  className: string | null;
  raceName: string | null;
  activeSpecName: string | null;
  avatarUrl: string | null;
};

export type WebViewer =
  | { authenticated: false }
  | {
      authenticated: true;
      mainCharacter: {
        characterId: string;
        realmId: string;
        name: string;
        realmName: string | null;
        rankIndex: number | null;
        level: number | null;
        className: string | null;
        activeSpecName: string | null;
        avatarUrl: string | null;
      } | null;
      characters: WebViewerCharacter[];
      discordAssociation: {
        username: string;
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

function renderDiscordAssociation(viewer: Extract<WebViewer, { authenticated: true }>, pathname: string): string {
  if (!viewer.discordAssociation) {
    return `<a class="discord-connect" href="/me/discord/connect?return_to=${encodeURIComponent(pathname)}">Connect Discord</a>`;
  }

  return `<div class="discord-connection" aria-label="Discord connected">
    <span class="discord-connection-dot" aria-hidden="true"></span>
    <span class="discord-connection-copy">
      <span class="discord-connection-name">${escapeHtml(viewer.discordAssociation.username)}</span>
      <span class="discord-connection-status">Discord</span>
    </span>
  </div>`;
}

function renderCurrentCharacter(viewer: Extract<WebViewer, { authenticated: true }>): string {
  if (!viewer.mainCharacter) {
    return `<div class="me-character-summary me-character-summary-empty">
      <span class="me-character-name" data-me-character-name>No main selected</span>
      <span class="me-character-meta" data-me-character-meta>Choose a guild character to present as.</span>
      <span class="me-character-context" data-me-character-context hidden></span>
      <button type="button" class="me-change-main" data-open-main-picker>Select main</button>
    </div>`;
  }

  const character = viewer.mainCharacter;
  const role = character.activeSpecName && character.className
    ? `${character.activeSpecName} ${character.className}`
    : character.className ?? character.activeSpecName ?? "Character";
  const realm = character.realmName ?? `Realm ${character.realmId}`;
  const rank = character.rankIndex === null
    ? ""
    : ` · <span class="guild-rank guild-rank-${character.rankIndex}" data-guild-rank="${character.rankIndex}">Rank ${character.rankIndex}</span>`;

  return `<div class="me-character-summary">
    <span class="me-character-name" data-me-character-name>${escapeHtml(character.name)}</span>
    <span class="me-character-meta" data-me-character-meta>${escapeHtml(role)}</span>
    <span class="me-character-context" data-me-character-context><span data-me-character-realm>${escapeHtml(realm)}</span>${rank}</span>
    <button type="button" class="me-change-main" data-open-main-picker>Change main</button>
  </div>`;
}

function renderMeControl(viewer: WebViewer, pathname: string): string {
  if (!viewer.authenticated) {
    return `<a class="me-control" href="/auth/blizzard/start?return_to=${encodeURIComponent(pathname)}" aria-label="Sign in">
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
      <span data-me-label>${escapeHtml(label)}</span>
      <span class="account-visual${viewer.mainCharacter?.avatarUrl ? " account-visual-portrait" : " account-visual-generic"}" data-me-visual>${portrait}</span>
    </summary>
    <div class="menu-panel menu-panel-right me-menu-panel">
      <section class="me-menu-section me-character-section">
        ${renderCurrentCharacter(viewer)}
      </section>
      <section class="me-menu-section me-discord-section">
        ${renderDiscordAssociation(viewer, pathname)}
      </section>
      <section class="me-menu-section me-session-section">
        <button type="button" class="me-sign-out" data-logout>Sign out</button>
      </section>
    </div>
  </details>`;
}

function characterMeta(character: WebViewerCharacter): string {
  const identity: string[] = [];
  if (character.level !== null) identity.push(`Level ${character.level}`);
  if (character.activeSpecName && character.className) {
    identity.push(`${character.activeSpecName} ${character.className}`);
  } else if (character.className) {
    identity.push(character.className);
  } else if (character.raceName) {
    identity.push(character.raceName);
  }
  return identity.length ? identity.join(" · ") : "Character profile not enriched yet";
}

function renderMainPicker(viewer: WebViewer): string {
  if (!viewer.authenticated) return "";

  const characters = viewer.characters.map((character) => {
    const selected = viewer.mainCharacter !== null &&
      viewer.mainCharacter.realmId === character.realmId &&
      viewer.mainCharacter.characterId === character.characterId;
    const portrait = character.avatarUrl
      ? `<img src="${escapeHtml(character.avatarUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
      : `<span class="character-portrait-placeholder" aria-hidden="true">${userGlyph()}</span>`;
    const location = character.realmName ?? `Realm ${character.realmId}`;
    const role = character.activeSpecName && character.className
      ? `${character.activeSpecName} ${character.className}`
      : character.className ?? character.activeSpecName ?? "Character";

    return `<button
      type="button"
      class="character-choice${selected ? " character-choice-current" : ""}"
      data-select-main
      data-character-id="${escapeHtml(character.characterId)}"
      data-realm-id="${escapeHtml(character.realmId)}"
      data-character-name="${escapeHtml(character.name)}"
      data-character-role="${escapeHtml(role)}"
      data-character-realm="${escapeHtml(location)}"
      data-character-rank="${character.rankIndex}"
      data-avatar-url="${escapeHtml(character.avatarUrl ?? "")}">
      <span class="character-portrait">${portrait}</span>
      <span class="character-choice-copy">
        <span class="character-choice-name">${escapeHtml(character.name)}${selected ? ' <span class="current-main-label">Current main</span>' : ""}</span>
        <span class="character-choice-meta">${escapeHtml(characterMeta(character))}</span>
        <span class="character-choice-submeta">${escapeHtml(location)} · Guild rank ${character.rankIndex}</span>
      </span>
    </button>`;
  }).join("\n");

  return `<dialog class="main-picker" data-main-picker data-has-main="${viewer.mainCharacter ? "true" : "false"}" aria-labelledby="main-picker-title">
    <div class="main-picker-sheet">
      <div class="main-picker-heading">
        <div>
          <p class="eyebrow">Your character</p>
          <h2 id="main-picker-title">Select your main</h2>
        </div>
        <button type="button" class="dialog-close" data-close-main-picker aria-label="Close main character picker">×</button>
      </div>
      <p class="main-picker-intro">Choose the OH CRIT I Pulled! character you want Guild Operations to present as your current main.</p>
      <button type="button" class="refresh-characters-action" data-refresh-characters>
        <span data-refresh-label>Refresh characters</span>
      </button>
      <div class="character-choices" data-character-choices>
        ${characters || '<p class="main-picker-empty">No currently eligible guild characters were found.</p>'}
      </div>
      <p class="main-picker-status" data-main-picker-status aria-live="polite"></p>
    </div>
  </dialog>`;
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
      ${renderMeControl(viewer, pathname)}
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
  ${renderMainPicker(input.viewer)}
  <script src="${assetUrl(assets, "app.js")}" defer></script>
</body>
</html>`;
}

export function htmlText(value: string): string {
  return escapeHtml(value);
}
