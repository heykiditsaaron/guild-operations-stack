import { guildieState } from "../application-state.js";
import { authenticatedGuildie } from "../auth.js";
import { administrationAvailabilityForGuildie } from "./administration.js";
import { moduleWebPresentationForGuildie } from "./module-presentation.js";
import type { WebViewer } from "./render.js";

export async function viewerForRequest(sessionToken: string | undefined): Promise<WebViewer> {
  const guildie = await authenticatedGuildie(sessionToken);

  if (!guildie) {
    return {
      authenticated: false,
      modulePresentation: await moduleWebPresentationForGuildie(null),
    };
  }

  const [state, administration, modulePresentation] = await Promise.all([
    guildieState(guildie.guildieId),
    administrationAvailabilityForGuildie(guildie.guildieId),
    moduleWebPresentationForGuildie(guildie.guildieId),
  ]);

  if (!state) {
    return {
      authenticated: false,
      modulePresentation: await moduleWebPresentationForGuildie(null),
    };
  }

  return {
    authenticated: true,
    modulePresentation,
    administrationAvailable: administration.available,
    administrationDestinations: administration.available
      ? [{ label: "Guild Operations", href: "/admin" }]
      : [],
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
