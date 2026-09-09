import type { FastifyInstance } from "fastify";
import type { AssetRegistry } from "../../web/assets.js";
import { registerDiscordAdminPage } from "./admin-page.js";
import { registerAdminDiscordStatePage } from "./admin-state-page.js";
import { registerDiscordAdministrationDestination } from "./administration.js";
import { registerDiscordGuildRefreshObserver } from "./guild-refresh.js";
import { registerDiscordRoutes } from "./routes.js";
import { registerDiscordWebPresentation } from "./web-presentation.js";

export function registerDiscordModuleAdministration(): void {
  registerDiscordAdministrationDestination();
  registerDiscordGuildRefreshObserver();
  registerDiscordWebPresentation();
}

export async function registerDiscordModule(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  await registerDiscordAdminPage(app, assets);
  await registerAdminDiscordStatePage(app, assets);
  await registerDiscordRoutes(app);
}
