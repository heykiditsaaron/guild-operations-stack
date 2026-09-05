import { config } from "../../config.js";
import { effectiveGuildAuthority, GuildCapabilityDeniedError } from "../../guild-permissions.js";

export const RAFFLE_ADMIN_CAPABILITY = "raffle.admin";

export async function raffleGuildieCanAdminister(guildieId: string): Promise<boolean> {
  const authority = await effectiveGuildAuthority(guildieId, config.guild.id);
  return authority !== null && authority.rankIndex >= 0 && authority.rankIndex <= 2;
}

export async function requireRaffleAdmin(guildieId: string): Promise<void> {
  if (!await raffleGuildieCanAdminister(guildieId)) {
    throw new GuildCapabilityDeniedError(config.guild.id, RAFFLE_ADMIN_CAPABILITY);
  }
}
