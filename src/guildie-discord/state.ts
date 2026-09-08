import { discordAssociationForGuildie } from "../discord-association.js";
import { getDiscordGuildMember } from "./client.js";

export type GuildieDiscordState = {
  guildieId: string;
  associated: boolean;
  discordUserId: string | null;
  presentInGuild: boolean;
  roleIds: string[];
  observedAt: number;
};

export async function discordStateForGuildie(guildieId: string): Promise<GuildieDiscordState> {
  const association = await discordAssociationForGuildie(guildieId);
  const observedAt = Math.floor(Date.now() / 1000);

  if (!association) {
    return {
      guildieId,
      associated: false,
      discordUserId: null,
      presentInGuild: false,
      roleIds: [],
      observedAt,
    };
  }

  const member = await getDiscordGuildMember(association.discordUserId);
  return {
    guildieId,
    associated: true,
    discordUserId: association.discordUserId,
    presentInGuild: Boolean(member),
    roleIds: member?.roleIds ?? [],
    observedAt,
  };
}
