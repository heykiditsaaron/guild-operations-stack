import { guildieState } from "../application-state.js";
import { authenticatedGuildie } from "../auth.js";
import { guildTheme } from "../guild-theme.js";
import { guildPresentation } from "../guild-presentation.js";
import {
  GUILD_REFRESH_CAPABILITY,
  OPERATIONS_INSPECT_CAPABILITY,
  guildieHasGuildCapability,
} from "../guild-permissions.js";
import { administrationAvailabilityForGuildie } from "./administration.js";
import { moduleWebPresentationForGuildie } from "./module-presentation.js";
import type { WebViewer } from "./render.js";

export async function viewerForRequest(sessionToken: string | undefined): Promise<WebViewer> {
  const [guildie, theme, presentation] = await Promise.all([authenticatedGuildie(sessionToken), guildTheme(), guildPresentation()]);

  if (!guildie) {
    return {
      authenticated: false,
      theme,
      guildPresentation: presentation,
      modulePresentation: await moduleWebPresentationForGuildie(null),
    };
  }

  const [state, administration, canRefreshGuild, canInspectOperations, modulePresentation] = await Promise.all([
    guildieState(guildie.guildieId),
    administrationAvailabilityForGuildie(guildie.guildieId),
    guildieHasGuildCapability(guildie.guildieId, GUILD_REFRESH_CAPABILITY),
    guildieHasGuildCapability(guildie.guildieId, OPERATIONS_INSPECT_CAPABILITY),
    moduleWebPresentationForGuildie(guildie.guildieId),
  ]);

  if (!state) {
    return {
      authenticated: false,
      theme,
      guildPresentation: presentation,
      modulePresentation: await moduleWebPresentationForGuildie(null),
    };
  }

  return {
    authenticated: true,
    theme,
    guildPresentation: presentation,
    modulePresentation,
    administrationAvailable: administration.available,
    administrationDestinations: administration.available
      ? [{ label: "Guild Operations", href: "/admin" }]
      : [],
    operationsAvailable: canRefreshGuild || canInspectOperations,
    mainCharacter: state.selectedMain
      ? {
          characterId: state.selectedMain.characterId,
          realmId: state.selectedMain.realmId,
          name: state.selectedMain.name,
          realmName: state.selectedMain.realmName,
          rankIndex: state.selectedMain.rankIndex,
          level: state.selectedMain.character?.level ?? null,
          className: state.selectedMain.character?.className ?? null,
          activeSpecName: state.selectedMain.character?.activeSpecName ?? null,
          avatarUrl: state.selectedMain.avatarUrl,
        }
      : null,
    characters: state.characters.map((character) => ({
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
