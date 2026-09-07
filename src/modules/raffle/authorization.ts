import { config } from "../../config.js";
import {
  effectiveGuildAuthority,
  GuildCapabilityDeniedError,
  type EffectiveGuildAuthority,
} from "../../guild-permissions.js";

export const RAFFLE_ADMIN_CAPABILITY = "raffle.admin";

export function raffleAuthorityCanAdminister(
  authority: EffectiveGuildAuthority | null,
): boolean {
  return authority !== null && authority.rankIndex >= 0 && authority.rankIndex <= 2;
}

export async function raffleGuildieCanAdminister(guildieId: string): Promise<boolean> {
  const authority = await effectiveGuildAuthority(guildieId, config.guild.id);
  return raffleAuthorityCanAdminister(authority);
}

export async function requireRaffleAdmin(guildieId: string): Promise<void> {
  if (!await raffleGuildieCanAdminister(guildieId)) {
    throw new GuildCapabilityDeniedError(config.guild.id, RAFFLE_ADMIN_CAPABILITY);
  }
}
