import { config } from "../config.js";
import { assetUrl, type AssetName, type AssetRegistry } from "./assets.js";

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

export type SecondaryNavigation =
  | { kind: "back"; label: string; href: string }
  | { kind: "breadcrumb"; items: readonly { label: string; href?: string }[] };

export type RenderPageInput = {
  pathname: string;
  title: string;
  description?: string;
  header: string;
  body: string;
  viewer: WebViewer;
  secondaryNavigation?: SecondaryNavigation;
  stylesheets?: AssetName[];
  scripts?: AssetName[];
};

function userGlyph(): string {
  return `<svg class="account-glyph" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="8" r="4"></circle>
    <path d="M4.8 20c.8-4 3.2-6 7.2-6s6.4 2 7.2 6"></path>
  </svg>`;
}

function discordGlyph(): string {
  return `<svg class="footer-discord-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7.5 7.2c3-1.4 6-1.4 9 0 1.8 2.4 2.7 5.2 2.5 8.1-1.6 1.2-3.1 1.9-4.6 2.3l-1.1-1.5"></path>
    <path d="M16.5 7.2c-3-1.4-6-1.4-9 0-1.8 2.4-2.7 5.2-2.5 8.1 1.6 1.2 3.1 1.9 4.6 2.3l1.1-1.5"></path>
    <circle cx="9.4" cy="12.5" r="0.8" fill="currentColor" stroke="none"></circle>
    <circle cx="14.6" cy="12.5" r="0.8" fill="currentColor" stroke="none"></circle>
  </svg>`;
}

function renderDiscordAssociation(viewer: Extract<WebViewer, { authenticated: true }>, pathname: string): string {
  if (!viewer.discordAssociation) {
    return `<a class="discord-connect" href="/me/discord/connect?return_to=${encodeURIComponent(pathname)}">Connect Discord</a>`;
  }
  return `<div class="discord-connection" aria-label="Discord connected">
    <span class="discord-connection-dot" aria-hidden="true"></span>
    <div class="discord-connection-copy">
      <span class="discord-connection-name">${escapeHtml(viewer.discordAssociation.username)}</span>
      <span class="discord-connection-status">Discord</span>
      <button type="button" class="me-change-main" data-disconnect-discord data-return-to="${escapeHtml(pathname)}">Disconnect</button>
    </div>
  </div>`;
}

function renderCurrentCharacter(viewer: Extract<WebViewer, { authenticated: true }>): string {
  if (!viewer.mainCharacter) {
    return `<div class="me-character-summary me-character-summary-empty">
      <span class="me-character-name" data-me-character-name>No main selected</span>
      <span class="me-character-meta" data-me-character-meta>Choose a character as your main.</span>
      <span class="me-character-context" data-me-character-context hidden></span>
      <button type="button" class="me-change-main" data-open-main-picker>Manage</button>
    </div>`;
  }
  const character = viewer.mainCharacter;
  const role = character.activeSpecName && character.className ? `${character.activeSpecName} ${character.className}` : character.className ?? character.activeSpecName ?? "Character";
  const realm = character.realmName ?? `Realm ${character.realmId}`;
  const rank = character.rankIndex === null ? "" : ` · <span class="guild-rank guild-rank-${character.rankIndex}" data-guild-rank="${character.rankIndex}">Rank ${character.rankIndex}</span>`;
  return `<div class="me-character-summary">
    <span class="me-character-name" data-me-character-name>${escapeHtml(character.name)}</span>
    <span class="me-character-meta" data-me-character-meta>${escapeHtml(role)}</span>
    <span class="me-character-context" data-me-character-context><span data-me-character-realm>${escapeHtml(realm)}</span>${rank}</span>
    <button type="button" class="me-change-main" data-open-main-picker>Manage</button>
  </div>`;
}

function renderMeControl(viewer: WebViewer, pathname: string): string {
  if (!viewer.authenticated) {
    return `<a class="me-control" href="/auth/blizzard/start?return_to=${encodeURIComponent(pathname)}" aria-label="Sign in"><span>Sign in</span><span class="account-visual account-visual-generic">${userGlyph()}</span></a>`;
  }
  const label = viewer.mainCharacter?.name ?? "Me";
  const portrait = viewer.mainCharacter?.avatarUrl ? `<img src="${escapeHtml(viewer.mainCharacter.avatarUrl)}" alt="" loading="eager" referrerpolicy="no-referrer">` : userGlyph();
  return `<details class="me-menu menu-surface">
    <summary class="me-control"><span data-me-label>${escapeHtml(label)}</span><span class="account-visual${viewer.mainCharacter?.avatarUrl ? " account-visual-portrait" : " account-visual-generic"}" data-me-visual>${portrait}</span></summary>
    <div class="menu-panel menu-panel-right me-menu-panel">
      <section class="me-menu-section me-character-section">${renderCurrentCharacter(viewer)}</section>
      <section class="me-menu-section me-discord-section">${renderDiscordAssociation(viewer, pathname)}</section>
      <section class="me-menu-section me-session-section"><button type="button" class="session-sign-out-action" data-logout>Sign out</button></section>
    </div>
  </details>`;
}

function characterMeta(character: WebViewerCharacter): string {
  const identity: string[] = [];
  if (character.level !== null) identity.push(`Level ${character.level}`);
  if (character.activeSpecName && character.className) identity.push(`${character.activeSpecName} ${character.className}`);
  else if (character.className) identity.push(character.className);
  else if (character.raceName) identity.push(character.raceName);
  return identity.length ? identity.join(" · ") : "Character profile not enriched yet";
}

function renderMainPicker(viewer: WebViewer): string {
  if (!viewer.authenticated) return "";
  const characters = viewer.characters.map((character) => {
    const selected = viewer.mainCharacter !== null && viewer.mainCharacter.realmId === character.realmId && viewer.mainCharacter.characterId === character.characterId;
    const portrait = character.avatarUrl ? `<img src="${escapeHtml(character.avatarUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="character-portrait-placeholder" aria-hidden="true">${userGlyph()}</span>`;
    const location = character.realmName ?? `Realm ${character.realmId}`;
    const role = character.activeSpecName && character.className ? `${character.activeSpecName} ${character.className}` : character.className ?? character.activeSpecName ?? "Character";
    return `<button type="button" class="character-choice${selected ? " character-choice-current" : ""}" data-select-main data-character-id="${escapeHtml(character.characterId)}" data-realm-id="${escapeHtml(character.realmId)}" data-character-name="${escapeHtml(character.name)}" data-character-role="${escapeHtml(role)}" data-character-realm="${escapeHtml(location)}" data-character-rank="${character.rankIndex}" data-avatar-url="${escapeHtml(character.avatarUrl ?? "")}">
      <span class="character-portrait">${portrait}</span><span class="character-choice-copy"><span class="character-choice-name">${escapeHtml(character.name)}${selected ? ' <span class="current-main-label">Current main</span>' : ""}</span><span class="character-choice-meta">${escapeHtml(characterMeta(character))}</span><span class="character-choice-submeta">${escapeHtml(location)} · Guild rank ${character.rankIndex}</span></span>
    </button>`;
  }).join("\n");
  return `<dialog class="main-picker" data-main-picker data-has-main="${viewer.mainCharacter ? "true" : "false"}" aria-labelledby="main-picker-title">
    <div class="main-picker-sheet">
      <div class="main-picker-heading"><h2 id="main-picker-title">Manage characters</h2><button type="button" class="dialog-close" data-close-main-picker aria-label="Close character management">×</button></div>
      <section class="main-picker-section main-picker-section-refresh" aria-labelledby="refresh-characters-title"><h3 id="refresh-characters-title">Refresh characters</h3><p class="main-picker-section-copy">Update your characters from Blizzard.</p><button type="button" class="refresh-characters-action" data-refresh-characters><span data-refresh-label>Refresh characters</span></button></section>
      <section class="main-picker-section main-picker-section-main" aria-labelledby="main-character-title"><h3 id="main-character-title">Main character</h3><p class="main-picker-section-copy">Choose the character you want shown as your main.</p><div class="character-choices" data-character-choices>${characters || '<p class="main-picker-empty">No currently eligible guild characters were found.</p>'}</div></section>
      <p class="main-picker-status" data-main-picker-status aria-live="polite"></p>
    </div>
  </dialog>`;
}

function renderActionBar(viewer: WebViewer, pathname: string): string {
  const homeActive = pathname === "/" ? ' aria-current="page"' : "";
  const eventsActive = pathname === "/events" || pathname.startsWith("/events/") ? ' aria-current="page"' : "";
  return `<nav class="action-bar" aria-label="Primary navigation"><div class="action-bar-inner">
    <details class="mobile-nav menu-surface"><summary class="icon-control" aria-label="Open navigation"><span></span><span></span><span></span></summary><div class="menu-panel menu-panel-left mobile-nav-panel"><a href="/"${homeActive}>Home</a><a href="/events"${eventsActive}>Events</a></div></details>
    <div class="desktop-nav"><a href="/"${homeActive}>Home</a><a href="/events"${eventsActive}>Events</a></div><div class="action-bar-spacer"></div>${renderMeControl(viewer, pathname)}
  </div></nav>`;
}

function renderSecondaryNavigation(navigation: SecondaryNavigation | undefined): string {
  if (!navigation) return "";
  if (navigation.kind === "back") return `<nav class="secondary-navigation secondary-navigation-back" aria-label="Secondary navigation"><a href="${escapeHtml(navigation.href)}">← ${escapeHtml(navigation.label)}</a></nav>`;
  if (navigation.items.length === 0) return "";
  const items = navigation.items.map((item, index) => {
    const terminal = index === navigation.items.length - 1;
    const label = escapeHtml(item.label);
    const content = item.href && !terminal ? `<a href="${escapeHtml(item.href)}">${label}</a>` : `<span${terminal ? ' aria-current="page"' : ""}>${label}</span>`;
    return `${index > 0 ? '<span class="secondary-navigation-separator" aria-hidden="true">›</span>' : ""}${content}`;
  }).join("");
  return `<nav class="secondary-navigation secondary-navigation-breadcrumb" aria-label="Breadcrumb">${items}</nav>`;
}

function externalFooterLink(url: string | null, label: string): string {
  if (!url) return "";
  return `<a class="footer-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

function renderFooter(): string {
  const discord = config.discordInviteUrl ? `<a class="footer-link footer-link-discord" href="${escapeHtml(config.discordInviteUrl)}" target="_blank" rel="noopener noreferrer">${discordGlyph()}<span>Discord</span></a>` : "";
  const wowLinks = [externalFooterLink(config.wowArmoryUrl, "WoW Armory"), externalFooterLink(config.raiderIoUrl, "Raider.IO"), externalFooterLink(config.warcraftLogsUrl, "Warcraft Logs")].filter(Boolean).join("");
  return `<footer class="app-footer"><div class="app-footer-inner">
    <div class="footer-brand"><span class="footer-guild-name">OH CRIT I Pulled!</span><span class="footer-guild-context">Gurubashi · US</span></div>
    <div class="footer-destinations">
      ${discord ? `<section class="footer-group" aria-label="Guild community"><p class="footer-group-title">Join us</p><div class="footer-links">${discord}</div></section>` : ""}
      ${wowLinks ? `<section class="footer-group" aria-label="Guild links"><p class="footer-group-title">Find us in Azeroth</p><div class="footer-links">${wowLinks}</div></section>` : ""}
    </div>
    <nav class="footer-site-information" aria-label="Site information"><a href="/privacy">Privacy</a><span aria-hidden="true">·</span><a href="/terms">Terms</a></nav>
  </div></footer>`;
}

export function renderPage(assets: AssetRegistry, input: RenderPageInput): string {
  const title = escapeHtml(input.title);
  const description = escapeHtml(input.description ?? "OH CRIT I Pulled!");
  const canonicalUrl = new URL(input.pathname, config.appOrigin).toString();
  const stylesheets = (input.stylesheets ?? []).map((name) => `  <link rel="stylesheet" href="${assetUrl(assets, name)}">`).join("\n");
  const scripts = (input.scripts ?? []).map((name) => `  <script src="${assetUrl(assets, name)}" defer></script>`).join("\n");
  const secondaryNavigation = renderSecondaryNavigation(input.secondaryNavigation);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${description}">
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="stylesheet" href="${assetUrl(assets, "app.css")}">
  <link rel="stylesheet" href="${assetUrl(assets, "footer.css")}">
  <link rel="stylesheet" href="${assetUrl(assets, "me.css")}">
  <link rel="stylesheet" href="${assetUrl(assets, "navigation-shelves.css")}">
${stylesheets ? `${stylesheets}\n` : ""}  <title>${title}</title>
</head>
<body>
  <div class="app-shell">
    ${renderActionBar(input.viewer, input.pathname)}
    ${secondaryNavigation ? `<div class="secondary-navigation-zone">${secondaryNavigation}</div>` : ""}
    <header class="page-header${secondaryNavigation ? " page-header-after-secondary-navigation" : ""}">${input.header}</header>
    <main class="app-main">${input.body}</main>
    ${renderFooter()}
  </div>
  ${renderMainPicker(input.viewer)}
  <script src="${assetUrl(assets, "app.js")}" defer></script>
  <script src="${assetUrl(assets, "navigation-shelves.js")}" defer></script>
${scripts ? `${scripts}\n` : ""}</body>
</html>`;
}

export function htmlText(value: string): string { return escapeHtml(value); }
