import { registerGuildCapabilityDefinitions } from "../../core/authority/guild-capability-policy.js";
import type { EffectiveGuildAuthority } from "../../core/authority/guild-permissions.js";

export const DISCORD_ADMIN_CAPABILITY = "guild.discord.manage";

export function registerDiscordCapabilityDefinitions(): void {
  registerGuildCapabilityDefinitions([
    { key: DISCORD_ADMIN_CAPABILITY, namespace: "discord", namespaceLabel: "Discord", label: "Configure Discord", description: "Configure the Discord integration and its guild projection policy.", defaultPermittedRanks: [0, 1, 2] },
  ]);
}

export function discordAuthorityCanAdminister(authority: EffectiveGuildAuthority): boolean {
  return authority.capabilities.includes(DISCORD_ADMIN_CAPABILITY);
}
