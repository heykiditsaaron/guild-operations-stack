import { guildCharactersForGuildie } from "../core/guild/guild-characters.js";
import { mainCharacterForGuildie } from "../core/identity/main-character.js";
import { authenticatedGuildie } from "../auth.js";
import { guildTheme } from "../guild-theme.js";
import { guildPresentation } from "../guild-presentation.js";
import {
  GUILD_REFRESH_CAPABILITY,
  OPERATIONS_INSPECT_CAPABILITY,
  guildieHasGuildCapability,
} from "../core/authority/guild-permissions.js";
import { administrationAvailabilityForGuildie } from "./administration.js";
import { webPresentationContributionsForGuildie } from "./presentation-contributions.js";
import type { WebViewer } from "./render.js";

export async function viewerForRequest(sessionToken: string | undefined): Promise<WebViewer> {
  const [guildie, theme, presentation] = await Promise.all([authenticatedGuildie(sessionToken), guildTheme(), guildPresentation()]);

  if (!guildie) {
    return {
      authenticated: false,
      theme,
      guildPresentation: presentation,
      presentationContributions: await webPresentationContributionsForGuildie(null),
    };
  }

  const [characters, selectedMain, administration, canRefreshGuild, canInspectOperations, presentationContributions] = await Promise.all([
    guildCharactersForGuildie(guildie.guildieId),
    mainCharacterForGuildie(guildie.guildieId),
    administrationAvailabilityForGuildie(guildie.guildieId),
    guildieHasGuildCapability(guildie.guildieId, GUILD_REFRESH_CAPABILITY),
    guildieHasGuildCapability(guildie.guildieId, OPERATIONS_INSPECT_CAPABILITY),
    webPresentationContributionsForGuildie(guildie.guildieId),
  ]);

  return {
    authenticated: true,
    theme,
    guildPresentation: presentation,
    presentationContributions,
    administrationAvailable: administration.available || canRefreshGuild || canInspectOperations,
    administrationDestinations: administration.available || canRefreshGuild || canInspectOperations
      ? [{ label: "Guild Operations Settings", href: "/admin" }]
      : [],
    operationsAvailable: false,
    mainCharacter: selectedMain
      ? {
          characterId: selectedMain.characterId,
          realmId: selectedMain.realmId,
          name: selectedMain.name,
          realmName: selectedMain.realmName,
          rankIndex: selectedMain.rankIndex,
          level: characters.find((character) => character.realmId === selectedMain.realmId && character.characterId === selectedMain.characterId)?.level ?? null,
          className: characters.find((character) => character.realmId === selectedMain.realmId && character.characterId === selectedMain.characterId)?.className ?? null,
          activeSpecName: characters.find((character) => character.realmId === selectedMain.realmId && character.characterId === selectedMain.characterId)?.activeSpecName ?? null,
          avatarUrl: selectedMain.avatarUrl,
        }
      : null,
    characters: characters.map((character) => ({
      characterId: character.characterId,
      realmId: character.realmId,
      name: character.name,
      realmName: character.realmName,
      rankIndex: character.rankIndex,
      level: character.level,
      className: character.className,
      raceName: character.raceName,
      activeSpecName: character.activeSpecName,
      avatarUrl: character.avatarUrl,
    })),
  };
}
