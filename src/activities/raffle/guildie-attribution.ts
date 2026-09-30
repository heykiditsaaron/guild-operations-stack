import { characterRepresentationForIdentity } from "../../core/identity/main-character.js";

export async function raffleGuildieAttribution(guildieId: string): Promise<string> {
  const mainCharacter = await characterRepresentationForIdentity(guildieId);
  return mainCharacter?.name ?? "Guild officer";
}
