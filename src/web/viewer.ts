import { guildieState } from "../application-state.js";
import { authenticatedGuildie } from "../auth.js";
import { discordAssociationForGuildie } from "../modules/discord/association.js";
import { discordModuleConfiguration } from "../modules/discord/module-configuration.js";
import { administrationAvailabilityForGuildie } from "./administration.js";
import type { WebViewer } from "./render.js";

export async function viewerForRequest(sessionToken: string | undefined): Promise<WebViewer> {
  const [guildie, discordConfiguration] = await Promise.all([
    authenticatedGuildie(sessionToken),
    discordModuleConfiguration(),
  ]);
  const discordEnabled = discordConfiguration.enabled;
  const discordInviteUrl = discordEnabled ? discordConfiguration.inviteUrl : null;

  if (!guildie) {
    return {
      authenticated: false,
      discordEnabled,
      discordInviteUrl,
    };
  }

  const [state, administration, discordAssociation] = await Promise.all([
    guildieState(guildie.guildieId),
    administrationAvailabilityForGuildie(guildie.guildieId),
    discordEnabled ? discordAssociationForGuildie(guildie.guildieId) : Promise.resolve(null),
  ]);

  if (!state) {
    return {
      authenticated: false,
      discordEnabled,
      discordInviteUrl,
    };
  }

  return {
    authenticated: true,
    discordEnabled,
    discordInviteUrl,
    administrationAvailable: administration.available,
    administrationDestinations: administration.navigationDestinations,
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
    discordAssociation: discordAssociation
      ? {
          username: discordAssociation.username,
        }
      : null,
  };
}
