import { mainCharacterForGuildie } from "../../main-character.js";

export async function raffleGuildieAttribution(guildieId: string): Promise<string> {
  const mainCharacter = await mainCharacterForGuildie(guildieId);
  return mainCharacter?.name ?? "Guild officer";
}
