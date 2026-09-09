import type { FastifyInstance } from "fastify";
import { registerDiscordRoutes } from "../../discord.js";
import type { AssetRegistry } from "../../web/assets.js";
import { registerAdminDiscordStatePage } from "../../web/pages/admin-discord-state.js";
import { registerDiscordAdminPage } from "./admin-page.js";
import { registerDiscordAdministrationDestination } from "./administration.js";
import { registerDiscordGuildRefreshObserver } from "./guild-refresh.js";

export function registerDiscordModuleAdministration(): void {
  registerDiscordAdministrationDestination();
  registerDiscordGuildRefreshObserver();
}

export async function registerDiscordModule(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  await registerDiscordAdminPage(app, assets);
  await registerAdminDiscordStatePage(app, assets);
  await registerDiscordRoutes(app);
}
