import type { EffectiveGuildAuthority } from "../../guild-permissions.js";
import { GUILD_DISCORD_MANAGE_CAPABILITY } from "../../guild-permissions.js";
import { registerModuleAdministrationDestination } from "../../web/admin-navigation.js";

export function discordAuthorityCanAdminister(authority: EffectiveGuildAuthority): boolean {
  return authority.capabilities.includes(GUILD_DISCORD_MANAGE_CAPABILITY);
}

export function registerDiscordAdministrationDestination(): void {
  registerModuleAdministrationDestination({
    label: "Discord",
    destination: "/admin/discord",
    permissionScope: GUILD_DISCORD_MANAGE_CAPABILITY,
    authorized: discordAuthorityCanAdminister,
  });
}
