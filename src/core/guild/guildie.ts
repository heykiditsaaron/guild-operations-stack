import { requireOperationalInstallationGuildBinding } from "../installation/guild-binding.js";
import { controlledGuildMemberCharacters, type ControlledGuildMemberCharacter } from "./guild-characters.js";

export type Guildie = {
  identityId: string;
  guildId: string;
  rankIndex: number;
  memberCharacters: ControlledGuildMemberCharacter[];
};

export async function guildie(
  identityId: string,
  guildId?: string,
): Promise<Guildie | null> {
  const resolvedGuildId = guildId ?? (await requireOperationalInstallationGuildBinding()).guildId;
  const memberCharacters = await controlledGuildMemberCharacters(identityId, resolvedGuildId);
  const highestAuthorityCharacter = memberCharacters[0];
  if (!highestAuthorityCharacter) return null;

  return {
    identityId,
    guildId: resolvedGuildId,
    rankIndex: highestAuthorityCharacter.rankIndex,
    memberCharacters,
  };
}

export async function isGuildie(identityId: string, guildId?: string): Promise<boolean> {
  return (await guildie(identityId, guildId)) !== null;
}
