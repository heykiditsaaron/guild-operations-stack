import { controlledGuildMemberCharacters } from "../core/guild/guild-characters.js";
import { characterRepresentationForIdentity } from "../core/identity/main-character.js";
import { characterProjections } from "../core/identity/character-projection.js";
import { authenticatedIdentity } from "../auth.js";
import { guildTheme } from "../core/presentation/guild-theme.js";
import { guildPresentation } from "../core/presentation/guild-presentation.js";
import {
  GUILD_REFRESH_CAPABILITY,
  OPERATIONS_INSPECT_CAPABILITY,
  identityHasGuildCapability,
} from "../core/authority/guild-permissions.js";
import { administrationAvailabilityForIdentity } from "./administration.js";
import { webPresentationContributionsForGuildie } from "./presentation-contributions.js";
import type { WebViewer } from "./render.js";

export async function viewerForRequest(sessionToken: string | undefined): Promise<WebViewer> {
  const [identity, theme, presentation] = await Promise.all([authenticatedIdentity(sessionToken), guildTheme(), guildPresentation()]);

  if (!identity) {
    return {
      authenticated: false,
      theme,
      guildPresentation: presentation,
      presentationContributions: await webPresentationContributionsForGuildie(null),
    };
  }

  const [guildMemberCharacters, selectedMain, administration, canRefreshGuild, canInspectOperations, presentationContributions] = await Promise.all([
    controlledGuildMemberCharacters(identity.identityId),
    characterRepresentationForIdentity(identity.identityId),
    administrationAvailabilityForIdentity(identity.identityId),
    identityHasGuildCapability(identity.identityId, GUILD_REFRESH_CAPABILITY),
    identityHasGuildCapability(identity.identityId, OPERATIONS_INSPECT_CAPABILITY),
    webPresentationContributionsForGuildie(identity.identityId),
  ]);

  const characters = await characterProjections(guildMemberCharacters.map((character) => character.characterRecordId));
  const guildMembershipByCharacterRecordId = new Map(guildMemberCharacters.map((character) => [character.characterRecordId, character]));

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
      rankIndex: guildMembershipByCharacterRecordId.get(character.characterRecordId)!.rankIndex,
      level: character.level,
      className: character.className,
      raceName: character.raceName,
      activeSpecName: character.activeSpecName,
      avatarUrl: character.avatarUrl,
    })),
  };
}
