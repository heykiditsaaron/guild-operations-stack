import type { FastifyInstance } from "fastify";
import type { AssetRegistry } from "../../web/assets.js";
import { registerDiscordAdminPage } from "./admin-page.js";
import { registerDiscordCapabilityDefinitions } from "./authorization.js";
import { registerDiscordGuildRefreshObserver } from "./guild-refresh.js";
import { registerDiscordRoleMapsPage } from "./role-maps-page.js";
import { registerDiscordRoutes } from "./routes.js";
import { registerDiscordWebPresentation } from "./web-presentation.js";

export function registerDiscordModuleAdministration(): void {
  registerDiscordCapabilityDefinitions();
  registerDiscordGuildRefreshObserver();
  registerDiscordWebPresentation();
}

export async function registerDiscordModule(app: FastifyInstance, assets: AssetRegistry): Promise<void> {
  await registerDiscordAdminPage(app, assets);
  await registerDiscordRoleMapsPage(app, assets);
  await app.register(async (discordApp) => {
    discordApp.addContentTypeParser(
      "application/x-www-form-urlencoded",
      { parseAs: "string" },
      (_request, body, done) => done(null, body),
    );
    await registerDiscordRoutes(discordApp);
  });
}
