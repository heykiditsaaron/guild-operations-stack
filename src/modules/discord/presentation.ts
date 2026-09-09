import {
  registerModuleWebPresentationProvider,
  type ModuleWebPresentation,
} from "../../web/module-presentation.js";
import { discordAssociationForGuildie } from "./association.js";
import { discordModuleConfiguration } from "./module-configuration.js";

function htmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function discordGlyph(): string {
  return `<svg class="footer-discord-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7.5 7.2c3-1.4 6-1.4 9 0 1.8 2.4 2.7 5.2 2.5 8.1-1.6 1.2-3.1 1.9-4.6 2.3l-1.1-1.5"></path>
    <path d="M16.5 7.2c-3-1.4-6-1.4-9 0-1.8 2.4-2.7 5.2-2.5 8.1 1.6 1.2 3.1 1.9 4.6 2.3l1.1-1.5"></path>
    <circle cx="9.4" cy="12.5" r="0.8" fill="currentColor" stroke="none"></circle>
    <circle cx="14.6" cy="12.5" r="0.8" fill="currentColor" stroke="none"></circle>
  </svg>`;
}

async function discordWebPresentation(guildieId: string | null): Promise<ModuleWebPresentation> {
  const configuration = await discordModuleConfiguration();
  if (!configuration.enabled) {
    return { meMenuSections: [], footerCommunityLinks: [], homeCommunityActions: [] };
  }

  const association = guildieId ? await discordAssociationForGuildie(guildieId) : null;
  const meMenuSections = guildieId
    ? [
        (pathname: string) => association
          ? `<section class="me-menu-section me-discord-section"><div class="discord-connection" aria-label="Discord connected">
              <span class="discord-connection-dot" aria-hidden="true"></span>
              <div class="discord-connection-copy">
                <span class="discord-connection-name">${htmlText(association.username)}</span>
                <span class="discord-connection-status">Discord</span>
                <button type="button" class="me-change-main" data-disconnect-discord data-return-to="${htmlText(pathname)}">Disconnect</button>
              </div>
            </div></section>`
          : `<section class="me-menu-section me-discord-section"><a class="discord-connect" href="/me/discord/connect?return_to=${encodeURIComponent(pathname)}">Connect Discord</a></section>`,
      ]
    : [];

  const footerCommunityLinks = configuration.inviteUrl
    ? [`<a class="footer-link footer-link-discord" href="${htmlText(configuration.inviteUrl)}" target="_blank" rel="noopener noreferrer">${discordGlyph()}<span>Discord</span></a>`]
    : [];
  const homeCommunityActions = configuration.inviteUrl
    ? [`<p class="home-orientation-action"><a class="button button-secondary" href="${htmlText(configuration.inviteUrl)}">Join us on Discord</a></p>`]
    : [];

  return { meMenuSections, footerCommunityLinks, homeCommunityActions };
}

export function registerDiscordWebPresentation(): void {
  registerModuleWebPresentationProvider(discordWebPresentation);
}
