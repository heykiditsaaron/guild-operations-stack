import { registerModuleAdministrationDestination } from "../../web/admin-navigation.js";
import { DISCORD_ADMIN_CAPABILITY, discordAuthorityCanAdminister } from "./authorization.js";

export function registerDiscordAdministrationDestination(): void {
  registerModuleAdministrationDestination({
    label: "Discord",
    destination: "/admin/discord",
    permissionScope: DISCORD_ADMIN_CAPABILITY,
    authorized: discordAuthorityCanAdminister,
  });
}
