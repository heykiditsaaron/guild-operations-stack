import { guildieState } from "../application-state.js";
import { authenticatedGuildie } from "../auth.js";
import { administrationAvailabilityForGuildie } from "./administration.js";
import type { WebViewer } from "./render.js";

export async function viewerForRequest(sessionToken: string | undefined): Promise<WebViewer> {
  const guildie = await authenticatedGuildie(sessionToken);
  if (!guildie) return { authenticated: false };

  const [state, administration] = await Promise.all([
    guildieState(guildie.guildieId),
    administrationAvailabilityForGuildie(guildie.guildieId),
  ]);

  if (!state) return { authenticated: false };

  const selectedCharacter = state.selectedMain
    ? state.characters.find((character) =>
        character.realmId === state.selectedMain?.realmId &&
        character.characterId === state.selectedMain?.characterId,
      ) ?? null
    : null;

  return {
    authenticated: true,
    administrationAvailable: administration.available,
    administrationDestinations: administration.navigationDestinations,
    mainCharacter: state.selectedMain
      ? {
          characterId: state.selectedMain.characterId,
          realmId: state.selectedMain.realmId,
          name: state.selectedMain.name,
          realmName: selectedCharacter?.realmName ?? state.selectedMain.realmName,
          rankIndex: selectedCharacter?.rankIndex ?? state.selectedMain.rankIndex,
          level: selectedCharacter?.level ?? null,
          className: selectedCharacter?.className ?? null,
          activeSpecName: selectedCharacter?.activeSpecName ?? null,
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
    discordAssociation: state.discordAssociation
      ? {
          username: state.discordAssociation.username,
        }
      : null,
  };
}
