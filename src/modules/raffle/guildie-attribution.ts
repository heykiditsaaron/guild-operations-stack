import { discordAssociationForGuildie } from "../../discord.js";
import { mainCharacterForGuildie } from "../../main-character.js";

export async function raffleGuildieAttribution(guildieId: string): Promise<string> {
  const [mainCharacter, discordAssociation] = await Promise.all([
    mainCharacterForGuildie(guildieId),
    discordAssociationForGuildie(guildieId),
  ]);

  return mainCharacter?.name ?? discordAssociation?.username ?? "Guild officer";
}
