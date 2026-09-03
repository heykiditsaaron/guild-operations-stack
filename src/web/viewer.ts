import { authenticatedSubject } from "../auth.js";
import { discordAssociationForSubject } from "../discord.js";
import { guildCharactersForSubject } from "../guild.js";
import { mainCharacterForSubject } from "../main-character.js";
import type { WebViewer } from "./render.js";

export async function viewerForRequest(sessionToken: string | undefined): Promise<WebViewer> {
  const subject = await authenticatedSubject(sessionToken);
  if (!subject) return { authenticated: false };

  const [mainCharacter, characters, discordAssociation] = await Promise.all([
    mainCharacterForSubject(subject.subjectId),
    guildCharactersForSubject(subject.subjectId),
    discordAssociationForSubject(subject.subjectId),
  ]);

  const selectedCharacter = mainCharacter
    ? characters.find((character) =>
        character.realmId === mainCharacter.realmId &&
        character.characterId === mainCharacter.characterId,
      ) ?? null
    : null;

  return {
    authenticated: true,
    mainCharacter: mainCharacter
      ? {
          characterId: mainCharacter.characterId,
          realmId: mainCharacter.realmId,
          name: mainCharacter.name,
          realmName: selectedCharacter?.realmName ?? mainCharacter.realmName,
          rankIndex: selectedCharacter?.rankIndex ?? mainCharacter.rankIndex,
          level: selectedCharacter?.level ?? null,
          className: selectedCharacter?.className ?? null,
          activeSpecName: selectedCharacter?.activeSpecName ?? null,
          avatarUrl: mainCharacter.avatarUrl,
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
    discordAssociation: discordAssociation
      ? {
          username: discordAssociation.username,
        }
      : null,
  };
}
