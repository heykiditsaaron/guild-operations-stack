import { registerGuildCapabilityDefinitions } from "../../guild-capability-policy.js";
import type { EffectiveGuildAuthority } from "../../guild-permissions.js";

export const DISCORD_ADMIN_CAPABILITY = "guild.discord.manage";

export function registerDiscordCapabilityDefinitions(): void {
  registerGuildCapabilityDefinitions([
    { key: DISCORD_ADMIN_CAPABILITY, namespace: "discord", namespaceLabel: "Discord", label: "Configure Discord", description: "Configure the Discord integration and its guild projection policy.", defaultPermittedRanks: [0, 1, 2] },
  ]);
}

export function discordAuthorityCanAdminister(authority: EffectiveGuildAuthority): boolean {
  return authority.capabilities.includes(DISCORD_ADMIN_CAPABILITY);
}
